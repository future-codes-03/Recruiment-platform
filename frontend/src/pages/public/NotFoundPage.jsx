import { Link } from "react-router-dom";
import Button from "../../components/shared/Button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="font-display text-5xl font-bold text-ink mb-2">404</div>
      <p className="text-sm text-slate mb-6">That page doesn't exist.</p>
      <Link to="/">
        <Button variant="primary">Back to home</Button>
      </Link>
    </div>
  );
}
