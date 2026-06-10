/**
 * ConnectionGuard has been disabled to bypass the backend waking up check page.
 * It now renders children immediately.
 */
export default function ConnectionGuard({ children }) {
  return children;
}
