'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Role = 'OWNER' | 'MANAGER' | 'STAFF';

interface SidebarProps {
  role: Role;
  companyName: string;
  currentPath: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  ownerOnly?: boolean;
}

interface NavSection {
  label?: string;
  items: NavItem[];
  collapsible?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Categories', href: '/categories' },
      { label: 'Add Catalog', href: '/catalog/new' },
      { label: 'Products', href: '/products' },
      { label: 'SKUs', href: '/skus' },
      { label: 'Purchases', href: '/purchases' },
      { label: 'Sales', href: '/sales' },
      { label: 'Invoices', href: '/invoices' },
      { label: 'Listings', href: '/listings' },
      { label: 'Storefront', href: '/storefront-manager' },
      { label: 'Inquiries', href: '/storefront-inquiries' },
      { label: 'Stock Ledger', href: '/stock-ledger' },
      { label: 'Returns Report', href: '/returns-report' },
    ],
  },
  {
    label: 'Manufacturing',
    collapsible: true,
    items: [
      { label: 'Production Batches', href: '/production-batches' },
      { label: 'Expenses', href: '/expenses' },
      { label: 'Cost Sheets', href: '/cost-sheets' },
    ],
  },
  {
    label: 'Tools',
    collapsible: true,
    items: [
      { label: 'Barcode Labels', href: '/barcode-labels' },
      { label: 'Stock Count', href: '/stock-count' },
    ],
  },
  {
    items: [
      { label: 'Users', href: '/users', ownerOnly: true },
      { label: 'Company', href: '/company', ownerOnly: true },
    ],
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default function Sidebar({ role, companyName, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Auto-expand sections that have the active link
    const expanded = new Set<string>();
    for (const section of NAV_SECTIONS) {
      if (section.label && section.collapsible) {
        const hasActive = section.items.some(
          (item) =>
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(item.href + '/')
        );
        if (hasActive) expanded.add(section.label);
      }
    }
    return expanded;
  });

  function toggleSection(label: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function closeMobile() {
    onMobileClose?.();
  }

  const sidebarContent = (
    <>
      {/* Company name header */}
      <div className="px-4 py-5 border-b border-indigo-800 flex items-center justify-between">
        <span className="text-white font-semibold text-sm truncate">
          {companyName}
        </span>
        {/* Close button on mobile */}
        <button
          onClick={closeMobile}
          className="lg:hidden text-indigo-300 hover:text-white p-1"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {NAV_SECTIONS.map((section, sectionIndex) => {
          const visibleItems = section.items.filter(
            (item) => !item.ownerOnly || role === 'OWNER'
          );

          if (visibleItems.length === 0) return null;

          const isExpanded = section.label ? expandedSections.has(section.label) : true;
          const isCollapsible = section.collapsible && section.label;

          return (
            <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-3' : ''}>
              {isCollapsible ? (
                <button
                  onClick={() => toggleSection(section.label!)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-200 hover:bg-indigo-800/50 transition-colors"
                >
                  <span>{section.label}</span>
                  <ChevronIcon open={isExpanded} />
                </button>
              ) : section.label ? (
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {section.label}
                </span>
              ) : null}

              {/* Collapsible content with animation */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isCollapsible && !isExpanded ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
                } ${section.label ? 'mt-1' : ''}`}
              >
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname === item.href ||
                          pathname.startsWith(item.href + '/');

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobile}
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-700 text-white'
                            : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-indigo-900 flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar — always visible on lg+ */}
      <aside
        className="hidden lg:flex w-60 flex-shrink-0 bg-indigo-900 flex-col h-full"
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
