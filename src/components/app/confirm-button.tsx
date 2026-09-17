"use client";

/** Submit button that asks for confirmation — for destructive server actions. */
export function ConfirmButton({
  children,
  message = "Are you sure?",
  className = "btn btn-danger btn-sm",
}: {
  children: React.ReactNode;
  message?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
