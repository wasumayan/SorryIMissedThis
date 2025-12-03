import { SimpleNetworkGraph } from "./SimpleNetworkGraph";

// Test component to demonstrate the network graph
export function NetworkGraphTest() {
  // Sample data - center node "You" with contacts around it
  const nodes = [
    { id: "you", name: "You" },
    { id: "contact1", name: "Alice" },
    { id: "contact2", name: "Bob" },
    { id: "contact3", name: "Charlie" },
    { id: "contact4", name: "Diana" },
    { id: "contact5", name: "Eve" },
  ];

  const links = [
    { source: "you", target: "contact1" },
    { source: "you", target: "contact2" },
    { source: "you", target: "contact3" },
    { source: "you", target: "contact4" },
    { source: "you", target: "contact5" },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', padding: '20px', backgroundColor: '#f5f5f5' }}>
      <h1 style={{ marginBottom: '20px', fontFamily: 'system-ui' }}>Network Graph Test</h1>
      <div style={{ width: '100%', height: 'calc(100% - 60px)', border: '2px solid #333', backgroundColor: 'white' }}>
        <SimpleNetworkGraph 
          nodes={nodes} 
          links={links} 
          width={window.innerWidth - 40}
          height={window.innerHeight - 100}
        />
      </div>
    </div>
  );
}

