"""
Upload routes for handling chat transcript uploads
"""

from flask import Blueprint, request, jsonify, current_app
import zipfile
import os
import tempfile
from werkzeug.utils import secure_filename

from app.services.chat_parser import ChatParser
from app.services.storage import StorageService
from app.services.ai_service import AIService
from app.models import User


upload_bp = Blueprint('upload', __name__)
storage = StorageService()
ai_service = AIService()


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'txt', 'zip'}


@upload_bp.route('/transcript', methods=['POST'])
def upload_transcript():
    """
    Upload and process chat transcript
    
    Expected:
        - file: .txt or .zip file containing WhatsApp chat export
        - user_id: User identifier
        - user_display_name: User's display name in the chat (optional)
    
    Returns:
        JSON response with processing results
    """
    
    try:
        # Validate request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed. Please upload .txt or .zip'}), 400
        
        # Get user information
        user_id = request.form.get('user_id', 'default_user')
        user_display_name = request.form.get('user_display_name', user_id)
        
        # Ensure user exists in database
        user = storage.get_user(user_id)
        if not user:
            user = User(user_id=user_id, display_name=user_display_name)
            storage.create_user(user)
            current_app.logger.info(f"Created new user: {user_id}")
        
        # Process file
        current_app.logger.info(f"Processing upload from user {user_id}: {file.filename}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save uploaded file
            filename = secure_filename(file.filename)
            file_path = os.path.join(temp_dir, filename)
            file.save(file_path)
            
            # Extract text files
            text_files = []
            
            if filename.endswith('.zip'):
                # Extract zip file
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                # Find all .txt files
                for root, dirs, files in os.walk(temp_dir):
                    for fname in files:
                        if fname.endswith('.txt'):
                            text_files.append(os.path.join(root, fname))
                
                if not text_files:
                    return jsonify({'error': 'No .txt files found in zip archive'}), 400
            
            else:
                # Single .txt file
                text_files = [file_path]
            
            # Parse all chat files
            parser = ChatParser(user_id)
            all_conversations = []
            
            for text_file in text_files:
                with open(text_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Parse messages
                messages = parser.parse_chat_file(content, user_display_name)
                
                if not messages:
                    current_app.logger.warning(f"No messages found in {text_file}")
                    continue
                
                # Create conversation
                conversation = parser.create_conversation(messages, user_display_name)
                all_conversations.append(conversation)
                
                current_app.logger.info(
                    f"Parsed conversation with {conversation.partner_name}: "
                    f"{len(messages)} messages"
                )
            
            if not all_conversations:
                return jsonify({'error': 'No valid conversations found in uploaded file(s)'}), 400
            
            # Save conversations to database
            conversation_ids = storage.bulk_save_conversations(all_conversations)
            
            # Generate initial prompts for each conversation
            prompts_generated = 0
            for conversation in all_conversations:
                # Update conversation_id from database
                conversation.conversation_id = conversation_ids.get(conversation.partner_name)
                
                # Generate prompts (async in production)
                try:
                    prompts = ai_service.generate_prompts(conversation, num_prompts=3)
                    for prompt in prompts:
                        prompt.conversation_id = conversation.conversation_id
                        storage.save_prompt(prompt)
                    prompts_generated += len(prompts)
                except Exception as e:
                    current_app.logger.error(f"Error generating prompts: {str(e)}")
            
            # Prepare response
            total_messages = sum(len(c.messages) for c in all_conversations)
            partners = [c.partner_name for c in all_conversations]
            
            response = {
                'success': True,
                'message': 'Chat transcript(s) processed successfully',
                'data': {
                    'user_id': user_id,
                    'conversations_processed': len(all_conversations),
                    'conversation_partners': partners,
                    'total_messages': total_messages,
                    'prompts_generated': prompts_generated,
                    'conversation_ids': list(conversation_ids.values())
                }
            }
            
            current_app.logger.info(
                f"Successfully processed upload for user {user_id}: "
                f"{len(all_conversations)} conversations, {total_messages} messages"
            )
            
            return jsonify(response), 200
    
    except zipfile.BadZipFile:
        return jsonify({'error': 'Invalid zip file'}), 400
    
    except UnicodeDecodeError:
        return jsonify({'error': 'Unable to read file. Please ensure it is a valid text file'}), 400
    
    except Exception as e:
        current_app.logger.error(f"Error processing upload: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Error processing file',
            'message': str(e)
        }), 500


@upload_bp.route('/status/<user_id>', methods=['GET'])
def get_upload_status(user_id):
    """
    Get upload/processing status for a user
    
    Returns:
        User statistics and conversation summary
    """
    
    try:
        user = storage.get_user(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        stats = storage.get_user_stats(user_id)
        conversations = storage.get_user_conversations(user_id, limit=10)
        
        conversation_summary = [
            {
                'partner_name': c.partner_name,
                'total_messages': c.metrics.total_messages,
                'days_since_contact': c.metrics.days_since_contact,
                'health': c.get_relationship_health()
            }
            for c in conversations
        ]
        
        return jsonify({
            'user_id': user_id,
            'display_name': user.display_name,
            'stats': stats,
            'recent_conversations': conversation_summary
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting upload status: {str(e)}")
        return jsonify({'error': 'Error retrieving status'}), 500