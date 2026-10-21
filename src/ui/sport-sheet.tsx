import { useMemo, useState } from 'preact/hooks';
import { customSportId, sportById, SPORTS } from '../sports';
import { Icon } from './icon';
import { Sheet } from './sheet';

type Props = {
  currentId: string | null;
  recent: string[];
  onPick: (id: string) => void;
  onClose: () => void;
};

export function SportSheet({ currentId, recent, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => (q ? SPORTS.filter((s) => s.name.toLowerCase().includes(q) || s.lower.toLowerCase().includes(q)) : SPORTS),
    [q],
  );
  const recentSports = recent.map(sportById);

  const useCustom = (name: string) => {
    const trimmed = name.trim();
    if (trimmed) onPick(customSportId(trimmed.slice(0, 40)));
  };

  return (
    <Sheet title="Choose a sport" onClose={onClose} class="sheet-tall">
      <div class="search">
        <Icon name="search" />
        <input
          type="search"
          class="input"
          placeholder="Search sports"
          value={query}
          aria-label="Search sports"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (list.length > 0) onPick(list[0].id);
              else useCustom(query);
            }
          }}
        />
      </div>

      {!q && recentSports.length > 0 && (
        <section class="sheet-section">
          <h3 class="section-title">Recent</h3>
          <div class="chip-row">
            {recentSports.map((s) => (
              <button key={s.id} type="button" class={`chip${s.id === currentId ? ' is-on' : ''}`} onClick={() => onPick(s.id)}>
                <Icon name={s.icon} />
                {s.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <div class="sport-grid">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            class={`sport-tile${s.id === currentId ? ' is-on' : ''}`}
            onClick={() => onPick(s.id)}
          >
            <Icon name={s.icon} class="icon-lg" />
            <span>{s.name}</span>
          </button>
        ))}
        {q && list.length === 0 && (
          <button type="button" class="sport-tile sport-tile-wide" onClick={() => useCustom(query)}>
            <Icon name="pencil" class="icon-lg" />
            <span>Use “{query.trim()}”</span>
          </button>
        )}
        {!customOpen && (
          <button type="button" class="sport-tile" onClick={() => setCustomOpen(true)}>
            <Icon name="pencil" class="icon-lg" />
            <span>Custom name…</span>
          </button>
        )}
      </div>

      {customOpen && (
        <form
          class="custom-row"
          onSubmit={(e) => {
            e.preventDefault();
            useCustom(custom);
          }}
        >
          <input
            class="input"
            type="text"
            maxLength={40}
            placeholder="e.g. Bouldering"
            aria-label="Custom sport name"
            value={custom}
            data-autofocus
            onInput={(e) => setCustom((e.currentTarget as HTMLInputElement).value)}
            ref={(el) => el?.focus()}
          />
          <button type="submit" class="btn btn-primary" disabled={!custom.trim()}>
            Use
          </button>
        </form>
      )}
    </Sheet>
  );
}
