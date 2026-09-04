import React from "react";

interface ToolbarItem<T extends string> {
    id: T;
    label: string;
}

interface Props<T extends string> {
    items: ToolbarItem<T>[];
    active: T;
    onChange: (id: T) => void;
    /** Optional content rendered on the right side of the toolbar */
    actions?: React.ReactNode;
}

export function TableToolbar<T extends string>({
    items,
    active,
    onChange,
    actions,
}: Props<T>) {
    const hasItems = items.length > 0;

    return (
        <div className="flex min-h-11 min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden scrollbar-none border-b border-gray-200 px-4 md:h-10 md:min-h-10 md:px-10">
            {hasItems && (
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto scrollbar-none md:gap-5">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onChange(item.id)}
                            className={`min-h-11 shrink-0 whitespace-nowrap py-2 text-xs transition-colors md:min-h-0 ${
                                active === item.id
                                    ? "font-medium text-gray-700"
                                    : "font-normal text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
            {actions && (
                <div
                    className={
                        hasItems
                            ? "flex shrink-0 items-center gap-2"
                            : "flex min-w-0 flex-1 items-center gap-2"
                    }
                >
                    {actions}
                </div>
            )}
        </div>
    );
}
