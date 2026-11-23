const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const ChatBubbleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M21 11.5C21 16 16.9 19.5 12 19.5c-1.2 0-2.3-.2-3.3-.6L4 21l1.3-3.6C3.8 16 3 13.9 3 11.5 3 7 7.1 3.5 12 3.5s9 3.5 9 8z" />
    <circle cx="8.5" cy="11.5" r=".8" fill="currentColor" />
    <circle cx="12" cy="11.5" r=".8" fill="currentColor" />
    <circle cx="15.5" cy="11.5" r=".8" fill="currentColor" />
  </svg>
);

export const NewChatIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M12 7v6M9 10h6" />
  </svg>
);

export const DotsIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);

export const BanIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </svg>
);

export const BroomIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M14 3l-2 7M9 10h6l2 5H7l2-5z" />
    <path d="M7 15l-1 6M10 15l-.5 6M13 15l.5 6M16 15l1 6" />
  </svg>
);

export const TrashIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const SendIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M22 3L2 11l8 3 3 8 9-19z" />
  </svg>
);

export const UnlockIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.6-1.7" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);
