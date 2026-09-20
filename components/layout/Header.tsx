"use client";

interface HeaderProps {
  companyName: string;
  userName: string;
  onLogout: () => void;
  onMenuClick?: () => void;
}

/**
 * Top header bar displaying the company name on the left
 * and the authenticated user's name + a logout button on the right. yes
 */
export default function Header({
  companyName,
  userName,
  onLogout,
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="h-14 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
      {/* Left: hamburger + company name */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        )}
        <span className="text-sm font-semibold text-gray-800 truncate">
          {companyName}
        </span>
      </div>

      {/* Right: user name + logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600 truncate max-w-[200px] hidden sm:inline">
          {userName}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          aria-label="Log out"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
