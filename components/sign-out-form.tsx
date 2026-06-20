import { LogOut } from "lucide-react";

export function SignOutForm() {
  return (
    <form action="/auth/sign-out" data-testid="sign-out-form" method="post">
      <button className="btn-secondary w-full sm:w-auto" data-testid="sign-out-button" type="submit">
        <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}
