import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface GsmSelectOption {
  value: string;
  label: string;
  merged?: boolean;
  members?: string[];
}

interface GsmSelectProps {
  label: string;
  value: string;
  placeholder: string;
  options: Array<string | GsmSelectOption>;
  onChange: (value: string) => void;
}

export function GsmSelect({ label, value, placeholder, options, onChange }: GsmSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const controlRef = useRef<HTMLDivElement>(null);
  const normalizedOptions = useMemo(
    () => options.map((option) => (typeof option === "string" ? { value: option, label: option } : option)),
    [options],
  );
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return normalizedOptions.filter(
      (option) =>
        !query ||
        option.value.toLocaleLowerCase("ru-RU").includes(query) ||
        option.label.toLocaleLowerCase("ru-RU").includes(query) ||
        option.members?.some((member) => member.toLocaleLowerCase("ru-RU").includes(query)),
    );
  }, [normalizedOptions, search]);

  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label;
  const selectedTitle = selectedOption?.merged
    ? `${selectedOption.label}: ${selectedOption.members?.join(", ") || "объединённое хозяйство"}`
    : value ? selectedLabel || value : placeholder;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (controlRef.current && !controlRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="gsm-custom-control" ref={controlRef}>
      <span className="gsm-control-label">{label}</span>
      <button
        className={`gsm-select-trigger${open ? " is-open" : ""}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selectedTitle}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? "gsm-select-value" : "gsm-select-placeholder"}>
          <span className="gsm-select-value-text">{value ? selectedLabel || value : placeholder}</span>
          {value && selectedOption?.merged ? <span className="gsm-select-merged-badge">Объединено</span> : null}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div className="gsm-select-menu" role="listbox" aria-label={label}>
          <div className="gsm-select-search">
            <Search size={15} aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={search}
              placeholder="Найти..."
              aria-label={`Поиск: ${label}`}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="gsm-select-options">
            <button className={`gsm-select-option${!value ? " is-selected" : ""}`} type="button" onClick={() => selectValue("")}>
              <span>{placeholder}</span>
              {!value ? <Check size={15} aria-hidden="true" /> : null}
            </button>
            {filteredOptions.map((option) => (
              <button
                className={`gsm-select-option${value === option.value ? " is-selected" : ""}${option.merged ? " is-merged" : ""}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                title={option.merged ? `${option.label}: ${option.members?.join(", ") || "объединённое хозяйство"}` : option.label}
                onClick={() => selectValue(option.value)}
              >
                <span className="gsm-select-option-copy">
                  <span className="gsm-select-option-title">{option.label}</span>
                  {option.merged ? (
                    <span className="gsm-select-option-meta">
                      <span className="gsm-select-merged-badge">Объединено</span>
                      <span className="gsm-select-option-members">{option.members?.join(" · ")}</span>
                    </span>
                  ) : null}
                </span>
                {value === option.value ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            ))}
            {!filteredOptions.length ? <div className="gsm-select-empty">Ничего не найдено</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
