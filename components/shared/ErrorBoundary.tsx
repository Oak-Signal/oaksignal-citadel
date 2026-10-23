"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/ErrorState";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

// Catches render errors below it so one broken panel does not blank the whole page.
// The error is logged to the console for diagnostics; users only see a generic message.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ui.render_error", error.message, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      this.props.fallback ?? (
        <ErrorState
          title="This section could not be shown"
          description="Something went wrong while displaying this content."
          action={<Button onClick={() => this.setState({ hasError: false })}>Try again</Button>}
        />
      )
    );
  }
}
