// The small ring a button shows while its action runs. It is 1em square, so
// it sits on the label's line without moving anything, and takes the button's
// text colour. With reduced motion it stays still.
export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-[1em] w-[1em] shrink-0 rounded-full border-2 border-current border-r-transparent align-[-0.125em] motion-safe:animate-spin ${className}`}
    />
  );
}
