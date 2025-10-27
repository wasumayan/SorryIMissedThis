export function Logo({ className = "", showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Mark: Abstract leaf/branch with message bubble */}
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Message bubble base */}
        <path
          d="M20 6C11.716 6 5 11.716 5 18.5C5 22.09 6.656 25.318 9.344 27.594L8 34L14.906 31.438C16.506 31.812 18.218 32 20 32C28.284 32 35 26.284 35 18.5C35 10.716 28.284 6 20 6Z"
          fill="#0d9488"
          opacity="0.15"
        />
        {/* Leaf/branch overlay */}
        <path
          d="M20 10C20 10 16 14 16 19C16 22.314 17.79 25 20 25C22.21 25 24 22.314 24 19C24 14 20 10 20 10Z"
          fill="#10b981"
          opacity="0.9"
        />
        {/* Leaf vein */}
        <path
          d="M20 10V25"
          stroke="#0d9488"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Side veins */}
        <path
          d="M20 15C20 15 18 16.5 17 18"
          stroke="#0d9488"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M20 15C20 15 22 16.5 23 18"
          stroke="#0d9488"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* Dew drop accent */}
        <circle cx="22" cy="13" r="2" fill="#0ea5e9" opacity="0.6" />
      </svg>
      
      {showWordmark && (
        <div className="flex flex-col">
          <span className="tracking-tight" style={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.2 }}>
            Sorry I Missed This
          </span>
          <span className="text-muted-foreground" style={{ fontSize: '0.75rem', lineHeight: 1 }}>
            Nurture your connections
          </span>
        </div>
      )}
    </div>
  );
}
