import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

export function ThemedSelect({ value, options = [], onChange, ariaLabel, compact = false }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const rootRef = useRef(null);
  const selectedRef = useRef(null);
  const normalized = options.map((option) => Array.isArray(option)
    ? { value: option[0], label: option[1] }
    : option);
  const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithKeyboard = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    requestAnimationFrame(() => selectedRef.current?.scrollIntoView({ block: "nearest" }));
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    const rect = rootRef.current?.getBoundingClientRect();
    setOpenUp(Boolean(rect && window.innerHeight - rect.bottom < 230 && rect.top > 230));
    setOpen(true);
  };

  return <div ref={rootRef} className={`themed-select ${open ? "open" : ""} ${openUp ? "open-up" : ""} ${compact ? "compact" : ""}`}>
    <button type="button" className="themed-select__trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
      <span>{selected?.label || "请选择"}</span><CaretDown size={15} />
    </button>
    {open ? <div className="themed-select__menu" role="listbox" aria-label={ariaLabel}>
      {normalized.map((option) => {
        const active = String(option.value) === String(value);
        return <button ref={active ? selectedRef : undefined} type="button" role="option" aria-selected={active} className={active ? "active" : ""} key={String(option.value)} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{active ? <Check size={16} weight="bold" /> : null}</button>;
      })}
    </div> : null}
  </div>;
}

export function useSwipeDownToClose(onClose, enabled = true) {
  const start = useRef(null);
  return {
    onTouchStart: (event) => {
      if (!enabled) return;
      const touch = event.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY, scrollY: event.currentTarget.scrollTop || 0 };
    },
    onTouchEnd: (event) => {
      if (!enabled || !start.current) return;
      const touch = event.changedTouches[0];
      const deltaY = touch.clientY - start.current.y;
      const deltaX = Math.abs(touch.clientX - start.current.x);
      if (start.current.scrollY <= 0 && deltaY > 86 && deltaY > deltaX * 1.25) onClose();
      start.current = null;
    },
  };
}
