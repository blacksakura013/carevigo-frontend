import React, { createContext, forwardRef, useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import "../styles/form-pages.css";

const PagesContext = createContext(null);

export function FormPage({ id, children, className = "" }) {
  const activeId = useContext(PagesContext);
  const hidden = activeId !== id;
  return <section className={`form-page ${className}`} data-form-page={id} hidden={hidden} inert={hidden || undefined}>{children}</section>;
}

const editable = field => !field.matches(":disabled") && !field.readOnly && field.type !== "hidden" && !field.closest("[hidden]");
function invalidField(page) {
  const fields = [...page.querySelectorAll("input,select,textarea")].filter(editable);
  return fields.find(field => {
    const required = field.required || field.getAttribute("aria-required") === "true";
    const missing = required && (field.type === "checkbox"
      ? !field.checked
      : field.type === "radio"
        ? !fields.some(other => other.type === "radio" && other.name === field.name && other.checked)
        : !String(field.value || "").trim());
    return missing || (field.willValidate && !field.validity.valid) || field.getAttribute("aria-invalid") === "true";
  });
}

function messageFor(field) {
  const label = (field.labels?.[0]?.textContent || field.getAttribute("aria-label") || "ช่องนี้").replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
  const name = label.length > 70 ? `${label.slice(0, 70)}…` : label;
  if (field.type === "checkbox" || field.type === "radio") return "กรุณาเลือกข้อมูลที่จำเป็นก่อนดำเนินการต่อ";
  if (!String(field.value || "").trim()) return `กรุณากรอก${name}`;
  if (field.validity.typeMismatch && field.type === "email") return "กรุณากรอกอีเมลให้ถูกต้อง";
  if (field.validity.rangeUnderflow) return `กรุณากรอก${name}ตั้งแต่ ${field.min} ขึ้นไป`;
  if (field.validity.rangeOverflow) return `กรุณากรอก${name}ไม่เกิน ${field.max}`;
  return `กรุณาตรวจสอบข้อมูลในช่อง${name}`;
}

const FormPages = forwardRef(function FormPages({ steps = [], busy = false, initialStep, onStepChange, children, className = "" }, forwardedRef) {
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex(step => step.id === initialStep)));
  const [visited, setVisited] = useState(index);
  const [error, setError] = useState("");
  const [focusRequest, setFocusRequest] = useState(null);
  const root = useRef(null), heading = useRef(null), awaitingErrors = useRef(false);
  const headingId = useId();
  const active = Math.min(index, Math.max(steps.length - 1, 0));
  const step = steps[active];
  const activeId = step?.id;
  const last = active === steps.length - 1;
  const latestOnStepChange = useRef(onStepChange);
  const notifiedStep = useRef(activeId);
  const visibleStep = useRef(activeId);
  latestOnStepChange.current = onStepChange;

  useEffect(() => {
    if (notifiedStep.current === activeId) return;
    notifiedStep.current = activeId;
    if (activeId) latestOnStepChange.current?.(activeId);
  }, [activeId]);

  useLayoutEffect(() => {
    if (visibleStep.current === activeId) return;
    visibleStep.current = activeId;
    // Portals need the same immediate close as fields hidden by this wizard.
    root.current?.dispatchEvent(new CustomEvent("save-stroke:form-step-change", { bubbles: true }));
  }, [activeId]);

  const move = (next, field = null) => {
    if (busy || next < 0 || next >= steps.length) return false;
    awaitingErrors.current = false;
    setError("");
    setIndex(next);
    setVisited(previous => Math.max(previous, next));
    setFocusRequest({ field });
    return true;
  };
  const focusField = fieldId => {
    const field = document.getElementById(fieldId);
    if (!field || !root.current?.contains(field)) return false;
    const page = field.closest("[data-form-page]");
    const next = steps.findIndex(item => item.id === page?.dataset.formPage);
    return next >= 0 ? move(next, field) : false;
  };
  useImperativeHandle(forwardedRef, () => ({
    focusField,
    goTo: id => move(steps.findIndex(item => item.id === id)),
    reset: () => {
      if (busy) return false;
      setVisited(0);
      return move(0);
    },
  }));

  useLayoutEffect(() => {
    if (!focusRequest) return;
    const target = focusRequest.field?.isConnected ? focusRequest.field : heading.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ behavior: "instant", block: focusRequest.field ? "center" : "start" });
  }, [active, focusRequest]);

  useLayoutEffect(() => {
    if (!root.current || typeof MutationObserver !== "function") return undefined;
    const observer = new MutationObserver(() => {
      if (!awaitingErrors.current) return;
      const candidates = root.current?.querySelectorAll('[aria-invalid="true"], .field-invalid input, .field-invalid select, .field-invalid textarea, .legal-agreements-invalid input');
      const field = [...(candidates || [])].find(node => node.matches("input,select,textarea") && !node.matches(":disabled"));
      const pageId = field?.closest("[data-form-page]")?.dataset.formPage;
      const next = steps.findIndex(item => item.id === pageId);
      if (next >= 0) {
        awaitingErrors.current = false;
        setIndex(next);
        setFocusRequest({ field });
      }
    });
    observer.observe(root.current, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-invalid", "class"] });
    return () => observer.disconnect();
  }, [steps]);

  const next = () => {
    if (busy || last) return;
    const page = [...root.current.querySelectorAll("[data-form-page]")].find(node => node.dataset.formPage === step.id);
    const invalid = page && invalidField(page);
    if (invalid) {
      setError(messageFor(invalid));
      setFocusRequest({ field: invalid });
      return;
    }
    move(active + 1);
  };
  const captureSubmit = event => {
    if (busy || !last) {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) next();
    } else awaitingErrors.current = true;
  };

  if (!step) return <>{children}</>;
  return <PagesContext.Provider value={step.id}>
    <div ref={root} className={`form-pages ${className}`} onSubmitCapture={captureSubmit} onInputCapture={() => { if (error) setError(""); awaitingErrors.current = false; }}>
      <nav className="form-pages-progress" aria-label="ขั้นตอนกรอกข้อมูล">
        <ol>{steps.map((item, position) => <li key={item.id} className={position === active ? "is-current" : position < visited ? "is-complete" : ""}>
          <button type="button" disabled={busy || position > visited} aria-current={position === active ? "step" : undefined} onClick={() => move(position)}>
            <span className="form-pages-step-number" aria-hidden="true">{position < visited && position !== active ? <Check size={18} /> : position + 1}</span>
            <span>{item.title}</span>
          </button>
        </li>)}</ol>
      </nav>
      <header className="form-pages-heading">
        <p className="form-pages-counter" aria-live="polite" aria-atomic="true">ขั้นตอนที่ {active + 1} จาก {steps.length}</p>
        <h2 id={headingId} ref={heading} tabIndex={-1}>{step.title}</h2>
        {step.description && <p>{step.description}</p>}
      </header>
      {error && <p className="form-pages-error" role="alert">{error}</p>}
      {children}
      <nav className="form-pages-navigation" aria-label="เปลี่ยนขั้นตอนกรอกข้อมูล">
        <button type="button" className="btn btn-secondary" disabled={busy || active === 0} onClick={() => move(active - 1)}><ArrowLeft size={20} />ย้อนกลับ</button>
        {!last && <button type="button" className="btn btn-primary" disabled={busy} onClick={next}>ถัดไป<ArrowRight size={20} /></button>}
      </nav>
    </div>
  </PagesContext.Provider>;
});

export default FormPages;
