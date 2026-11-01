import React, { forwardRef, useImperativeHandle } from "react";

// Business-rule suites exercise validation/retries independently of pagination.
// FormPages and page integration suites cover the actual visible-step workflow.
const InlineFormPages = forwardRef(function InlineFormPages({ children }, ref) {
  useImperativeHandle(ref, () => ({
    focusField: (id) => document.getElementById(id)?.focus(),
    goTo: () => undefined,
    reset: () => undefined,
  }), []);
  return <>{children}</>;
});
export function FormPage({ children }) { return <>{children}</>; }
export default InlineFormPages;
