import React from "react";
import AppError from "@/components/shared/AppError";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppError
          title="Something went wrong"
          message={this.props.message ?? "This section failed to load. Try again."}
          onRetry={this.handleRetry}
          onHome={this.props.showHome ? this.handleHome : undefined}
          fullScreen={this.props.fullScreen}
        />
      );
    }
    return this.props.children;
  }
}
