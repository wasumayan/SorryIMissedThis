/**
 * Photon iMessage Bridge Server
 *
 * Simple bridge between Photon SDK and Python backend.
 * Uses SDK API directly - no complex transformations.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { IMessageSDK } from "@photon-ai/imessage-kit";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PHOTON_PORT || 4000;
const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || "http://localhost:5002";

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SDK
const sdk = new IMessageSDK({
  debug: process.env.PHOTON_LOG_LEVEL === "debug",
  maxConcurrent: 5,
  watcher: {
    pollInterval: 2000,
    unreadOnly: false,
    excludeOwnMessages: false,
  },
});

let isWatching = false;
let activeUserId = null;

// Look up contact name from macOS Contacts app
// Uses AppleScript to query Contacts database
async function lookupContactName(phoneNumber, email) {
  try {
    let script = "";
    if (phoneNumber) {
      // Clean phone number (remove +, spaces, dashes, parentheses)
      const cleanPhone = phoneNumber
        .replace(/[\s\-()]/g, "")
        .replace(/^\+/, ""); // Try multiple formats
      const formats = [
        cleanPhone, // +1234567890
        cleanPhone.replace(/^1/, ""), // 234567890 (without country code)
        `+${cleanPhone}`, // Ensure + prefix
      ];
      for (const format of formats) {
        script = `
          tell application "Contacts"
            set foundContacts to (every person whose value of phone contains "${format}")
            if (count of foundContacts) > 0 then
              set contactName to name of item 1 of foundContacts
              return contactName
            end if
          end tell
          return ""
        `;
        try {
          const { stdout } = await execAsync(
            `osascript -e '${script.replace(/'/g, "'\\''")}'`
          );
          const name = stdout.trim();
          if (name && name !== "") {
            return name;
          }
        } catch (e) {
          // Try next format
          continue;
        }
      }
    }
    if (email) {
      script = `
        tell application "Contacts"
          set foundContacts to (every person whose value of email contains "${email}")
          if (count of foundContacts) > 0 then
            set contactName to name of item 1 of foundContacts
            return contactName
          end if
        end tell
        return ""
      `;
      try {
        const { stdout } = await execAsync(
          `osascript -e '${script.replace(/'/g, "'\\''")}'`
        );
        const name = stdout.trim();
        if (name && name !== "") {
          return name;
        }
      } catch (e) {
        // Not found
      }
    }
    return null;
  } catch (error) {
    console.error("[ERROR] Contact lookup failed:", error.message);
    return null;
  }
}

// Extract phone/email from chatId
function extractContactInfo(chatId) {
  if (!chatId) return { phone: null, email: null }; // Check if it's a service-prefixed format (DM)
  if (chatId.includes(";")) {
    const parts = chatId.split(";");
    const identifier = parts[parts.length - 1]; // Last part is the identifier
    if (identifier.includes("@") && identifier.includes(".")) {
      return { phone: null, email: identifier };
    } else if (/^\+?[\d\s\-()]+$/.test(identifier)) {
      return { phone: identifier, email: null };
    }
  } // Check if it's just a phone number or email
  if (chatId.includes("@") && chatId.includes(".")) {
    return { phone: null, email: chatId };
  } else if (/^\+?[\d\s\-()]+$/.test(chatId)) {
    return { phone: chatId, email: null };
  }
  return { phone: null, email: null };
}

// Transform SDK message to backend format
// Uses ISO 8601 date strings for consistency
function transformMessage(messageData) {
  if (!messageData) {
    console.error("[ERROR] transformMessage: messageData is null/undefined");
    return null;
  }
  const dateToISO = (date) => {
    if (!date) {
      return new Date().toISOString(); // Fallback to current time
    }
    if (date instanceof Date) {
      return date.toISOString();
    }
    if (typeof date === "string") {
      try {
        return new Date(date).toISOString();
      } catch (e) {
        console.error("[ERROR] Invalid date string:", date);
        return new Date().toISOString();
      }
    }
    try {
      return new Date(date).toISOString();
    } catch (e) {
      console.error("[ERROR] Invalid date:", date);
      return new Date().toISOString();
    }
  };

  return {
    guid: messageData.guid || null,
    id: messageData.id || null,
    text: messageData.text || "", // Legacy format for backward compatibility
    handle: {
      address: messageData.sender || "Unknown",
      name: messageData.senderName || messageData.sender || "Unknown",
    },
    sender: messageData.sender || "Unknown",
    senderName: messageData.senderName || messageData.sender || "Unknown",
    chatGuid: messageData.chatId || null,
    chatId: messageData.chatId || null,
    isFromMe: messageData.isFromMe || false,
    isRead: messageData.isRead || false,
    isGroupChat: messageData.isGroupChat || false,
    service: messageData.service || null,
    date: dateToISO(messageData.date),
    dateCreated: dateToISO(messageData.date),
    attachments: (messageData.attachments || []).map((att) => ({
      guid: att?.id || att?.guid || null,
      mimeType: att?.mimeType || "",
      filename: att?.filename || "",
      path: att?.path || "",
      size: att?.size || 0,
    })),
  };
}

// Forward message to backend
async function forwardMessageToBackend(messageData) {
  const messageId = messageData?.guid || messageData?.id || "unknown";
  try {
    if (!messageData) {
      console.error(
        "[ERROR] forwardMessageToBackend: messageData is null/undefined"
      );
      return;
    }
    console.log(
      `[DEBUG] forwardMessageToBackend: Processing message ${messageId} from chatId: ${
        messageData.chatId || "unknown"
      }`
    );
    const transformed = transformMessage(messageData);
    if (!transformed) {
      console.error(
        `[ERROR] forwardMessageToBackend: transformMessage returned null for message ${messageId}`
      );
      return;
    }
    const payload = {
      type: "new-message",
      data: transformed,
    };
    if (activeUserId) {
      payload.userId = activeUserId;
      console.log(
        `[DEBUG] forwardMessageToBackend: Forwarding message ${messageId} to backend for userId: ${activeUserId}`
      );
    } else {
      console.warn(
        `[WARN] forwardMessageToBackend: No activeUserId set, forwarding message ${messageId} without userId`
      );
    }
    await axios.post(`${PYTHON_BACKEND_URL}/api/imessage/webhook`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    console.log(
      `[DEBUG] forwardMessageToBackend: ✅ Successfully forwarded message ${messageId} to backend`
    );
  } catch (error) {
    console.error(
      `[ERROR] forwardMessageToBackend: ❌ Failed to forward message ${messageId}:`,
      error.message
    );
    if (error.response) {
      console.error(
        `[ERROR] forwardMessageToBackend: Backend response status: ${error.response.status}, data:`,
        error.response.data
      );
    }
  }
}

// Start watching for messages
async function startWatching() {
  if (isWatching) {
    console.log("[DEBUG] startWatching: Already watching, skipping");
    return true;
  }
  try {
    console.log("[DEBUG] startWatching: Starting message watcher...");
    await sdk.startWatching({
      onMessage: async (message) => {
        const messageId = message?.guid || message?.id || "unknown";
        console.log(
          `[DEBUG] startWatching: New message received: ${messageId} from ${
            message?.sender || "unknown"
          } in chat ${message?.chatId || "unknown"}`
        );
        forwardMessageToBackend(message).catch((err) => {
          console.error(
            `[ERROR] startWatching: Error forwarding message ${messageId}:`,
            err.message
          );
        });
      },
      onError: (error) => {
        console.error("[ERROR] startWatching: Watcher error:", error.message);
        console.error("[ERROR] startWatching: Error stack:", error.stack);
      },
    });
    isWatching = true;
    console.log(
      "[DEBUG] startWatching: ✅ Successfully started watching for messages"
    );
    return true;
  } catch (error) {
    console.error(
      "[ERROR] startWatching: ❌ Failed to start watching:",
      error.message
    );
    console.error("[ERROR] startWatching: Error stack:", error.stack);
    return false;
  }
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: isWatching ? "ready" : "disconnected",
    watching: isWatching,
  });
});

// Server info
app.get("/api/server/info", async (req, res) => {
  res.json({
    message: "Local iMessage database access",
    platform: "macOS",
    detected_imessage: null,
    detected_icloud: null,
    detected_icloud_name: null,
    computer_id: null,
  });
});

// OPTIMIZATION: Cache for contact name lookups to avoid redundant AppleScript calls
const contactNameCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedContactName(phone, email) {
  const key = phone || email;
  if (!key) return null;
  const cached = contactNameCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.name;
  }
  return null;
}

function setCachedContactName(phone, email, name) {
  const key = phone || email;
  if (key && name) {
    contactNameCache.set(key, { name, timestamp: Date.now() });
  }
}

// Get chats - use SDK directly
// Always use chatId from SDK response as authoritative source
// Look up contact names from Contacts app when displayName is null
app.get("/api/chats", async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();
  console.log(`[DEBUG] [${requestId}] GET /api/chats: Request received`);
  console.log(
    `[DEBUG] [${requestId}] Query params:`,
    JSON.stringify(req.query)
  );
  try {
    const limit = parseInt(req.query.limit) || 100;
    console.log(
      `[DEBUG] [${requestId}] Calling sdk.listChats({ limit: ${limit}, sortBy: 'recent' })`
    );
    const chats = await sdk.listChats({ limit, sortBy: "recent" });
    console.log(
      `[DEBUG] [${requestId}] ✅ SDK returned ${chats.length} chats (took ${
        Date.now() - startTime
      }ms)`
    ); // Map chats and look up contact names for DMs without displayName // OPTIMIZATION: Use cache to avoid redundant AppleScript calls
    const mappedChats = await Promise.all(
      chats.map(async (chat) => {
        let displayName = chat.displayName; // If no displayName and it's a DM, try to look up from Contacts app
        if (!displayName && !chat.isGroup) {
          const contactInfo = extractContactInfo(chat.chatId);
          const { phone, email } = contactInfo; // Check cache first
          const cachedName = getCachedContactName(phone, email);
          if (cachedName) {
            displayName = cachedName;
            console.log(
              `[DEBUG] [${requestId}] Using cached contact name for ${chat.chatId}: ${displayName}`
            );
          } else if (phone || email) {
            // Look up from Contacts app
            try {
              const contactName = await lookupContactName(phone, email);
              if (contactName) {
                displayName = contactName;
                setCachedContactName(phone, email, contactName);
                console.log(
                  `[DEBUG] [${requestId}] Found contact name for ${chat.chatId}: ${displayName}`
                );
              } else {
                console.log(
                  `[DEBUG] [${requestId}] No contact name found for ${
                    chat.chatId
                  } (phone: ${phone || "N/A"}, email: ${email || "N/A"})`
                );
              }
            } catch (error) {
              console.error(
                `[ERROR] [${requestId}] Contact lookup failed for ${chat.chatId}:`,
                error.message
              ); // Continue without contact name - backend AI inference will handle it
            }
          }
        }
        return {
          guid: chat.chatId, // Use chatId as guid (authoritative)
          chatId: chat.chatId, // SDK's chatId - use this for all operations
          displayName: displayName || null, // Legacy fields for backward compatibility
          chatIdentifier: chat.chatId,
          style: chat.isGroup ? 43 : 0,
          isGroup: chat.isGroup,
          participants: [], // SDK doesn't provide participants
          lastMessageDate: chat.lastMessageAt
            ? chat.lastMessageAt.toISOString()
            : null,
          unreadCount: chat.unreadCount,
        };
      })
    );
    const totalTime = Date.now() - startTime;
    console.log(
      `[DEBUG] [${requestId}] ✅ Successfully mapped ${mappedChats.length} chats (total time: ${totalTime}ms)`
    );
    res.json({ chats: mappedChats });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `[ERROR] [${requestId}] ❌ GET /api/chats failed after ${totalTime}ms:`,
      error.message
    );
    console.error(`[ERROR] [${requestId}] Stack trace:`, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Get messages - use chatId directly from SDK
// CRITICAL: SDK's getMessages filters by chat.chat_identifier (raw DB value)
// but listChats() returns a constructed chatId. We need to match them properly.
app.get("/api/messages", async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();
  console.log(`[DEBUG] [${requestId}] GET /api/messages: Request received`);
  console.log(
    `[DEBUG] [${requestId}] Query params:`,
    JSON.stringify(req.query)
  );
  try {
    const { chatGuid, limit = 100, offset = 0 } = req.query;
    if (!chatGuid) {
      console.error(
        `[ERROR] [${requestId}] ❌ Missing required parameter: chatGuid`
      );
      return res.status(400).json({ error: "chatGuid is required" });
    }
    console.log(
      `[DEBUG] [${requestId}] Looking up messages for chatGuid: "${chatGuid}" (limit: ${limit}, offset: ${offset})`
    ); // OPTIMIZATION: Cache listChats results to avoid redundant calls // This endpoint is called frequently, so caching helps significantly
    const CACHE_KEY = "listChats_cache";
    const CACHE_TTL_MS = 30 * 1000; // 30 seconds
    let chats = null;
    const cached = global[CACHE_KEY];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      chats = cached.data;
      console.log(
        `[DEBUG] [${requestId}] Using cached listChats (${chats.length} chats)`
      );
    } else {
      console.log(
        `[DEBUG] [${requestId}] Searching for chat in listChats (searching ${1000} chats)...`
      );
      chats = await sdk.listChats({ limit: 1000 });
      global[CACHE_KEY] = { data: chats, timestamp: Date.now() };
      console.log(
        `[DEBUG] [${requestId}] Retrieved ${chats.length} chats from SDK and cached`
      );
    }
    const matchingChat = chats.find(
      (chat) =>
        chat.chatId === chatGuid ||
        chat.chatId === chatGuid.replace(/^iMessage;/, "") ||
        chat.chatId === chatGuid.replace(/^SMS;/, "") ||
        chat.chatId === chatGuid.replace(/^RCS;/, "")
    );
    if (!matchingChat) {
      console.log(
        `[DEBUG] [${requestId}] ⚠️ Chat not found in listChats for chatGuid: "${chatGuid}", trying direct query with multiple formats`
      ); // Try multiple formats as fallback
      const formatsToTry = [
        chatGuid, // Original format
        chatGuid.includes(";") ? chatGuid.split(";").slice(1).join(";") : null, // Without service prefix
        chatGuid.startsWith("chat") ? chatGuid : null, // Group GUID as-is
      ].filter(Boolean);
      let result = { messages: [], total: 0 }; // SDK doesn't support offset, so we fetch more messages and slice them
      const offsetNum = parseInt(offset) || 0;
      const limitNum = parseInt(limit) || 100;
      for (let i = 0; i < formatsToTry.length; i++) {
        const format = formatsToTry[i];
        console.log(
          `[DEBUG] [${requestId}] Attempt ${i + 1}/${
            formatsToTry.length
          }: Trying chatId format: "${format}"`
        );
        result = await sdk.getMessages({
          chatId: format,
          limit: offsetNum + limitNum, // Fetch enough to cover offset + limit
          excludeOwnMessages: false,
        });
        console.log(
          `[DEBUG] [${requestId}] Format "${format}" returned ${result.messages.length} messages`
        );
        if (result.messages.length > 0) {
          console.log(
            `[DEBUG] [${requestId}] ✅ SUCCESS: Found ${result.messages.length} messages with format: "${format}"`
          );
          break;
        }
      }
      console.log(
        `[DEBUG] [${requestId}] Direct query final result: ${result.messages.length} messages (total available: ${result.total})`
      ); // Apply pagination (SDK doesn't support offset, so we slice after fetching)
      const messages = result.messages.slice(offsetNum, offsetNum + limitNum);
      const mappedMessages = messages.map((msg) => ({
        guid: msg.guid,
        id: msg.id,
        text: msg.text,
        handle: {
          address: msg.sender,
          name: msg.senderName || msg.sender,
        },
        sender: msg.sender,
        senderName: msg.senderName,
        chatGuid: msg.chatId,
        chatId: msg.chatId,
        isFromMe: msg.isFromMe,
        isRead: msg.isRead,
        isGroupChat: msg.isGroupChat,
        service: msg.service,
        date: msg.date.toISOString(),
        dateCreated: msg.date.toISOString(),
        attachments: (msg.attachments || []).map((att) => ({
          guid: att.id,
          mimeType: att.mimeType,
          filename: att.filename,
          path: att.path,
          size: att.size,
        })),
      }));
      const totalTime = Date.now() - startTime;
      console.log(
        `[DEBUG] [${requestId}] ✅ Returning ${mappedMessages.length} mapped messages (total available: ${result.total}, time: ${totalTime}ms)`
      );
      return res.json({ messages: mappedMessages, total: result.total });
    }
    console.log(
      `[DEBUG] [${requestId}] ✅ Found matching chat in listChats: chatId="${
        matchingChat.chatId
      }", isGroup=${matchingChat.isGroup}, displayName="${
        matchingChat.displayName || "null"
      }"`
    ); // Use the SDK's chatId from listChats - it should match what getMessages expects // For groups, chatId is the GUID. For DMs, it's the service-prefixed identifier.
    let chatIdToUse = matchingChat.chatId; // For group chats, extract just the GUID part if chatGuid has the full format
    if (matchingChat.isGroup && chatGuid.includes("chat")) {
      // Extract GUID from formats like "iMessage;+;chat123..." or "chat123..."
      const guidMatch = chatGuid.match(/chat[0-9]+/);
      if (guidMatch) {
        chatIdToUse = guidMatch[0];
        console.log(
          `[DEBUG] [${requestId}] Extracted group GUID from "${chatGuid}" → "${chatIdToUse}"`
        );
      }
    } // Try with the SDK's chatId first // SDK doesn't support offset, so we fetch more messages and slice them
    const offsetNum = parseInt(offset) || 0;
    const limitNum = parseInt(limit) || 100;
    console.log(
      `[DEBUG] [${requestId}] Calling sdk.getMessages({ chatId: "${chatIdToUse}", limit: ${
        offsetNum + limitNum
      }, excludeOwnMessages: false })`
    );
    let result = await sdk.getMessages({
      chatId: chatIdToUse,
      limit: offsetNum + limitNum, // Fetch enough to cover offset + limit
      excludeOwnMessages: false,
    });
    console.log(
      `[DEBUG] [${requestId}] First attempt with chatId "${chatIdToUse}" returned ${result.messages.length} messages (total available: ${result.total})`
    ); // If 0 messages and it's a group chat, try extracting GUID from the original chatGuid
    if (result.messages.length === 0 && matchingChat.isGroup) {
      const guidMatch = chatGuid.match(/chat[0-9]+/);
      if (guidMatch && guidMatch[0] !== chatIdToUse) {
        const guidOnly = guidMatch[0];
        console.log(
          `[DEBUG] [${requestId}] Retry attempt: Trying group GUID format: "${guidOnly}"`
        );
        const retryResult = await sdk.getMessages({
          chatId: guidOnly,
          limit: offsetNum + limitNum, // Fetch enough to cover offset + limit
          excludeOwnMessages: false,
        });
        console.log(
          `[DEBUG] [${requestId}] Retry with "${guidOnly}" returned ${retryResult.messages.length} messages`
        );
        if (retryResult.messages.length > 0) {
          console.log(
            `[DEBUG] [${requestId}] ✅ SUCCESS: Found ${retryResult.messages.length} messages with format: "${guidOnly}"`
          );
          result = retryResult;
        }
      }
    } // If 0 messages and it's a DM, try extracting just the address (without service prefix)
    if (
      result.messages.length === 0 &&
      !matchingChat.isGroup &&
      chatIdToUse.includes(";")
    ) {
      const addressOnly = chatIdToUse.split(";").slice(1).join(";");
      console.log(
        `[DEBUG] [${requestId}] Retry attempt: Trying DM format without service prefix: "${addressOnly}"`
      );
      const retryResult = await sdk.getMessages({
        chatId: addressOnly,
        limit: offsetNum + limitNum, // Fetch enough to cover offset + limit
        excludeOwnMessages: false,
      });
      console.log(
        `[DEBUG] [${requestId}] Retry with "${addressOnly}" returned ${retryResult.messages.length} messages`
      );
      if (retryResult.messages.length > 0) {
        console.log(
          `[DEBUG] [${requestId}] ✅ SUCCESS: Found ${retryResult.messages.length} messages with format: "${addressOnly}"`
        );
        result = retryResult;
      }
    } // Apply pagination (SDK doesn't support offset, so we slice after fetching)
    const messages = result.messages.slice(offsetNum, offsetNum + limitNum);
    console.log(
      `[DEBUG] [${requestId}] After pagination: ${messages.length} messages (from ${result.messages.length} fetched, offset: ${offsetNum}, limit: ${limitNum})`
    ); // Map to backend format with ISO date strings
    const mappedMessages = messages.map((msg) => ({
      guid: msg.guid,
      id: msg.id,
      text: msg.text, // Legacy format for backward compatibility
      handle: {
        address: msg.sender,
        name: msg.senderName || msg.sender,
      },
      sender: msg.sender,
      senderName: msg.senderName,
      chatGuid: msg.chatId,
      chatId: msg.chatId,
      isFromMe: msg.isFromMe,
      isRead: msg.isRead,
      isGroupChat: msg.isGroupChat,
      service: msg.service,
      date: msg.date.toISOString(),
      dateCreated: msg.date.toISOString(),
      attachments: (msg.attachments || []).map((att) => ({
        guid: att?.id || att?.guid || null,
        mimeType: att?.mimeType || "",
        filename: att?.filename || "",
        path: att?.path || "",
        size: att?.size || 0,
      })),
    }));
    const totalTime = Date.now() - startTime;
    console.log(
      `[DEBUG] [${requestId}] ✅ Successfully returning ${mappedMessages.length} mapped messages (total available: ${result.total}, time: ${totalTime}ms)`
    );
    res.json({ messages: mappedMessages, total: result.total });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `[ERROR] [${requestId}] ❌ GET /api/messages failed after ${totalTime}ms:`,
      error.message
    );
    console.error(`[ERROR] [${requestId}] Stack trace:`, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Send message
// Supports both string message and content object (text, images, files)
app.post("/api/messages/send", async (req, res) => {
  try {
    const { chatGuid, message, content } = req.body;

    console.log(
      `[DEBUG] POST /api/messages/send: Received chatGuid="${chatGuid}"`
    );

    if (!chatGuid) {
      return res.status(400).json({ error: "chatGuid is required" });
    }

    // Support both legacy string format and new content object format
    let contentToSend;
    if (content) {
      // New format: { text?, images?, files? }
      contentToSend = {
        text: content.text,
        images: content.images || [],
        files: content.files || [],
      };
    } else if (message) {
      // Legacy format: string message
      contentToSend = message;
    } else {
      return res.status(400).json({ error: "message or content is required" });
    }

    // CRITICAL: Look up chat in listChats to get the SDK's authoritative chatId format
    // Use cached listChats if available
    const CACHE_KEY = "listChats_cache";
    const CACHE_TTL_MS = 30 * 1000;

    let chats = null;
    const cached = global[CACHE_KEY];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      chats = cached.data;
      console.log(
        `[DEBUG] POST /api/messages/send: Using cached listChats (${chats.length} chats)`
      );
    } else {
      console.log(`[DEBUG] POST /api/messages/send: Fetching listChats...`);
      chats = await sdk.listChats({ limit: 1000 });
      global[CACHE_KEY] = { data: chats, timestamp: Date.now() };
      console.log(
        `[DEBUG] POST /api/messages/send: Retrieved ${chats.length} chats from SDK`
      );
    }

    // Find matching chat - try various format matches
    const matchingChat = chats.find(
      (chat) =>
        chat.chatId === chatGuid ||
        chat.chatId === chatGuid.replace(/^any;/, "") ||
        chat.chatId === chatGuid.replace(/^iMessage;/, "") ||
        chat.chatId === chatGuid.replace(/^SMS;/, "") ||
        (chatGuid.includes("chat") &&
          chat.chatId.includes(chatGuid.match(/chat[0-9]+/)?.[0]))
    );

    if (matchingChat) {
      console.log(
        `[DEBUG] POST /api/messages/send: Found matching chat with chatId="${
          matchingChat.chatId
        }", isGroup=${matchingChat.isGroup}, displayName="${
          matchingChat.displayName || "null"
        }"`
      );

      // WORKAROUND: SDK's validation rejects "any;" prefix, but Messages.app requires it
      // For group chats with "any;" prefix, call AppleScript directly to bypass SDK validation
      if (matchingChat.isGroup && matchingChat.chatId.startsWith("any;")) {
        console.log(
          `[DEBUG] POST /api/messages/send: Using direct AppleScript for "any;" prefix group chat`
        );

        try {
          const messageText =
            typeof contentToSend === "string"
              ? contentToSend
              : contentToSend.text || "";

          if (!messageText) {
            return res
              .status(400)
              .json({ error: "Text message required for group chats" });
          }

          // Properly escape strings for AppleScript
          // Double quotes need to be escaped as \"
          // Backslashes need to be escaped as \\
          const escapeForAppleScript = (str) => {
            return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          };

          const escapedText = escapeForAppleScript(messageText);
          const escapedChatId = escapeForAppleScript(matchingChat.chatId);

          const script = `tell application "Messages"
    set targetChat to chat id "${escapedChatId}"
    send "${escapedText}" to targetChat
end tell`;

          console.log(
            `[DEBUG] POST /api/messages/send: Executing AppleScript with chatId="${matchingChat.chatId}"`
          );

          await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

          const sentAt = new Date();
          console.log(
            `[DEBUG] POST /api/messages/send: ✅ Message sent successfully via AppleScript`
          );

          return res.json({
            success: true,
            result: { sentAt: sentAt.toISOString() },
          });
        } catch (error) {
          console.error(
            `[ERROR] POST /api/messages/send: AppleScript failed:`,
            error.message
          );
          return res.status(500).json({ error: error.message });
        }
      }

      // For other chats, use SDK normally
      console.log(
        `[DEBUG] POST /api/messages/send: Using SDK with chatId="${matchingChat.chatId}"`
      );

      const result = await sdk.send(matchingChat.chatId, contentToSend);

      const transformedResult = {
        sentAt: result.sentAt.toISOString(),
        message: result.message
          ? {
              ...result.message,
              date: result.message.date.toISOString(),
            }
          : undefined,
      };

      return res.json({ success: true, result: transformedResult });
    } else {
      console.error(
        `[ERROR] POST /api/messages/send: Chat not found in listChats for chatGuid="${chatGuid}"`
      );
      return res.status(404).json({
        error: `Chat not found: ${chatGuid}. Please sync conversations first.`,
      });
    }

    // Fallback: Normalize chatId format for SDK
    // SDK expects: "iMessage;+15551234567" or "SMS;+15551234567"
    let chatIdToSend = chatGuid;

    if (!chatIdToSend.includes(";")) {
      // No semicolon - assume it's a bare phone/email
      chatIdToSend = `iMessage;${chatIdToSend}`;
      console.log(
        `[DEBUG] POST /api/messages/send: Added iMessage prefix: "${chatIdToSend}"`
      );
    } else if (chatIdToSend.startsWith("any;")) {
      // Malformed format like "any;+;+15551234567"
      // Extract the address part and use iMessage
      const parts = chatIdToSend.split(";");
      const address = parts[parts.length - 1]; // Last part is the address
      chatIdToSend = `iMessage;${address}`;
      console.log(
        `[DEBUG] POST /api/messages/send: Fixed malformed chatId to "${chatIdToSend}"`
      );
    }

    console.log(
      `[DEBUG] POST /api/messages/send: Sending to chatId="${chatIdToSend}"`
    );

    // SDK handles chatId normalization internally
    const result = await sdk.send(chatIdToSend, contentToSend); // Transform result to include ISO date
    const transformedResult = {
      sentAt: result.sentAt.toISOString(),
      message: result.message
        ? {
            ...result.message,
            date: result.message.date.toISOString(),
          }
        : undefined,
    };
    res.json({ success: true, result: transformedResult });
  } catch (error) {
    console.error("[ERROR] POST /api/messages/send:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get contacts (empty - SDK doesn't provide this)
app.get("/api/contacts", async (req, res) => {
  res.json({ contacts: [] });
});

// Connect - start watching
app.post("/api/connect", async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();
  console.log(`[DEBUG] [${requestId}] POST /api/connect: Request received`);
  console.log(`[DEBUG] [${requestId}] Request body:`, JSON.stringify(req.body));
  try {
    const userId = req.body?.userId || req.query?.userId;
    if (userId) {
      activeUserId = userId;
      console.log(`[DEBUG] [${requestId}] Set activeUserId: ${userId}`);
    } else {
      console.warn(`[WARN] [${requestId}] No userId provided in request`);
    }
    const started = await startWatching();
    if (started) {
      const totalTime = Date.now() - startTime;
      console.log(
        `[DEBUG] [${requestId}] ✅ POST /api/connect: Success - watching started (time: ${totalTime}ms)`
      );
      res.json({ success: true, message: "Started watching for messages" });
    } else {
      const totalTime = Date.now() - startTime;
      console.error(
        `[ERROR] [${requestId}] ❌ POST /api/connect: Failed to start watching (time: ${totalTime}ms)`
      );
      res
        .status(503)
        .json({ success: false, error: "Failed to start watching" });
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `[ERROR] [${requestId}] ❌ POST /api/connect failed after ${totalTime}ms:`,
      error.message
    );
    console.error(`[ERROR] [${requestId}] Stack trace:`, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect - stop watching
app.post("/api/disconnect", async (req, res) => {
  try {
    sdk.stopWatching(); // stopWatching() is synchronous, not async
    isWatching = false;
    res.json({ success: true, message: "Stopped watching for messages" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Photon Bridge Server running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  if (isWatching) {
    sdk.stopWatching(); // stopWatching() is synchronous, not async
  }
  await sdk.close();
  process.exit(0);
});