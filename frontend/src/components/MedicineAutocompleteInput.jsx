import React, { useState, useEffect, useRef } from 'react';
import { searchMedicines } from '../services/medicineService';
import { Search, Loader2, Pill, Check, AlertCircle } from 'lucide-react';

/**
 * MedicineAutocompleteInput
 * Real-time autocomplete component connecting to Medicine Master Database
 */
const MedicineAutocompleteInput = ({
  value = '',
  onChange = () => {},
  onSelectMedicine = () => {},
  onClear = () => {},
  placeholder = '',
  id = 'medicine-search-input',
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const activeSearchId = useRef(0);

  // Sync external value changes to local input state
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Handle outside click to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search logic
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError('');
      setIsOpen(false);
      return;
    }

    const searchId = ++activeSearchId.current;
    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const res = await searchMedicines(trimmed);

        // Ignore stale requests
        if (searchId !== activeSearchId.current) return;

        if (res && res.success) {
          setSuggestions(res.medicines || []);
          setIsOpen(true);
          setHighlightedIndex(-1);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        if (searchId !== activeSearchId.current) return;
        console.warn('Medicine search failed:', err);
        setError('Unable to search medicines. Please try again.');
        setSuggestions([]);
        setIsOpen(true);
      } finally {
        if (searchId === activeSearchId.current) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setQuery(newVal);
    onChange(newVal);
    if (!newVal.trim()) {
      onClear();
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (medicine) => {
    setQuery(medicine.genericName);
    setIsOpen(false);
    setSuggestions([]);
    onSelectMedicine(medicine);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          type="text"
          className="form-input"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim().length >= 2 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${id}-suggestions`}
          style={{ paddingRight: '2.25rem' }}
        />
        <div
          style={{
            position: 'absolute',
            right: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            color: 'var(--slate-400)',
          }}
        >
          {loading ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-600)' }} />
          ) : (
            <Search size={16} />
          )}
        </div>
      </div>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '0.35rem 0',
            margin: 0,
            listStyle: 'none',
          }}
        >
          {error ? (
            <li
              style={{
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                color: 'var(--danger-600)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </li>
          ) : suggestions.length === 0 ? (
            <li
              style={{
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                color: 'var(--slate-500)',
                textAlign: 'center',
              }}
            >
              No medicines found matching "<strong>{query}</strong>"
            </li>
          ) : (
            suggestions.map((med, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <li
                  key={med._id || index}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => handleSelect(med)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    padding: '0.65rem 1rem',
                    cursor: 'pointer',
                    background: isHighlighted ? '#f0f9ff' : 'transparent',
                    borderLeft: isHighlighted ? '3px solid var(--primary-600)' : '3px solid transparent',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Pill size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--slate-900)' }}>
                        {med.genericName}
                      </span>
                    </div>
                    {med.drugClass && (
                      <span
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--slate-100)',
                          color: 'var(--slate-700)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {med.drugClass}
                      </span>
                    )}
                  </div>

                  {/* Brand names summary */}
                  {med.brandNames && med.brandNames.length > 0 && (
                    <div style={{ fontSize: '0.785rem', color: 'var(--slate-500)', marginTop: '2px', paddingLeft: '23px' }}>
                      Brands: {med.brandNames.slice(0, 3).join(', ')}
                      {med.brandNames.length > 3 ? ` (+${med.brandNames.length - 3} more)` : ''}
                    </div>
                  )}

                  {/* Available forms & strengths summary */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '2px', paddingLeft: '23px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {med.dosageForms && med.dosageForms.length > 0 && (
                      <span>Forms: {med.dosageForms.join(', ')}</span>
                    )}
                    {med.availableStrengths && med.availableStrengths.length > 0 && (
                      <span>• Strengths: {med.availableStrengths.map((s) => (typeof s === 'object' && s ? `${s.value} ${s.unit}` : String(s))).join(', ')}</span>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

export default MedicineAutocompleteInput;
