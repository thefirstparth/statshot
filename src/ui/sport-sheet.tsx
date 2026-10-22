import { useMemo, useState } from 'preact/hooks';
import { CATEGORY_NAMES, CATEGORY_ORDER, customSportId, isKnownSport, searchSports, sportById, SPORTS, type Sport } from '../sports';
import { Icon } from './icon';
import { Sheet } from './sheet';
import { SportSticker } from './sticker';

type Props = {
  currentId: string | null;
  recent: string[];
  onPick: (id: string) => void;
  onClose: () => void;
};

function Tile({ sport, on, onPick, big }: { sport: Sport; on: boolean; onPick: (id: string) => void; big?: boolean }) {
  return (
    <button type="button" class={`sport-tile${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onPick(sport.id)}>
      <SportSticker sport={sport} size={big ? 64 : 52} />
      <span>{sport.name}</span>
    </button>
  );
}

export function SportSheet({ currentId, recent, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const results = useMemo(() => searchSports(q), [q]);
  const recentSports = recent.filter(isKnownSport).map(sportById).slice(0, 6);

  const useCustom = () => {
    if (q) onPick(customSportId(q));
  };

  return (
    <Sheet title="What was this workout?" onClose={onClose} class="sheet-tall sheet-sports">
      <div class="search">
        <Icon name="search" />
        <input
          type="search"
          class="input"
          placeholder="Search, or type your own"
          value={query}
          aria-label="Search sports"
          enterKeyHint="done"
          maxLength={40}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (results.length > 0 && q) onPick(results[0].id);
              else useCustom();
            }
          }}
        />
      </div>

      {q ? (
        <div class="sport-grid">
          {results.map((s) => (
            <Tile key={s.id} sport={s} on={s.id === currentId} onPick={onPick} />
          ))}
          <button type="button" class="sport-tile sport-tile-custom" onClick={useCustom}>
            <span class="custom-badge">
              <Icon name="edit" />
            </span>
            <span>Use “{Array.from(q).length > 18 ? Array.from(q).slice(0, 17).join('') + '…' : q}”</span>
          </button>
        </div>
      ) : (
        <>
          {recentSports.length > 0 && (
            <section class="sheet-section sticker-shelf">
              <h3 class="section-title">Used lately</h3>
              <div class="sport-grid sport-grid-3">
                {recentSports.map((s) => (
                  <Tile key={s.id} sport={s} on={s.id === currentId} onPick={onPick} big />
                ))}
              </div>
            </section>
          )}
          {CATEGORY_ORDER.map((cat) => (
            <section key={cat} class="sheet-section">
              <h3 class="section-title">{CATEGORY_NAMES[cat]}</h3>
              <div class="sport-grid">
                {SPORTS.filter((s) => s.cat === cat).map((s) => (
                  <Tile key={s.id} sport={s} on={s.id === currentId} onPick={onPick} />
                ))}
              </div>
            </section>
          ))}
          <p class="fine-print">Not listed? Type its name in the search box and tap “Use”.</p>
        </>
      )}
    </Sheet>
  );
}
