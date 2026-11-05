import React from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { useClub } from '@/store/useClub';
import { Avatar, Bar, Btn, Card, Chip, Empty, Pill, Row, Screen, SectionTitle, Segmented, Stepper, Txt } from '@/ui/kit';
import { Pitch, surname } from '@/ui/Pitch';
import { useTheme } from '@/ui/theme';
import type { Availability } from '@/domain/types';
import { buildSlots, formationsFor, getFormation, minutesFromPlan, planRotation } from '@/domain/lineup';
import { parentExplainer, squadRank } from '@/domain/fairness';
import { formatDate } from '@/domain/util';
import { overall } from '@/domain/ratings';

const BALANCES = [
  { value: 0.15, label: 'Develop' },
  { value: 0.5, label: 'Balanced' },
  { value: 0.85, label: 'Compete' },
];

export default function FixtureScreen() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useClub((s) => s.fixtures.find((x) => x.id === id));
  const { club, players, byId, stats, statById, fixtures } = useDerived();
  const setAvailability = useClub((s) => s.setAvailability);
  const setPlan = useClub((s) => s.setPlan);
  const saveFixture = useClub((s) => s.saveFixture);
  const completeFixture = useClub((s) => s.completeFixture);

  const [periodIdx, setPeriodIdx] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [balance, setBalance] = React.useState<number>(f?.plan?.balance ?? club.balance);
  const [goalsFor, setGoalsFor] = React.useState(0);
  const [goalsAgainst, setGoalsAgainst] = React.useState(0);
  const [explain, setExplain] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [includeMaybe, setIncludeMaybe] = React.useState(false);

  // minutes before this match: exclude this fixture's own minutes when viewing a played match
  const priorMinutes = React.useMemo(() => {
    const m: Record<string, number> = {};
    fixtures
      .filter((x) => x.status === 'played' && x.id !== id)
      .forEach((x) => Object.entries(x.minutes ?? {}).forEach(([pid, v]) => (m[pid] = (m[pid] ?? 0) + v)));
    return m;
  }, [fixtures, id]);

  if (!f) {
    return (
      <Screen>
        <Empty icon="calendar-outline" title="Fixture not found" action={<Btn label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const formation = getFormation(f.formationId, f.format);
  const slots = buildSlots(formation);
  const played = f.status === 'played';
  const fitPlayers = players.filter((p) => p.status === 'fit');
  const avail = fitPlayers.filter((p) => f.availability[p.id] === 'yes' || (includeMaybe && f.availability[p.id] === 'maybe'));
  const maybeCount = fitPlayers.filter((p) => f.availability[p.id] === 'maybe').length;
  const planPeriods = f.plan?.periods;
  const pitchWidth = Math.min(width - 32, 400);

  const generate = () => {
    const out = planRotation({ players: avail, slots, periods: f.periods, minPct: club.minMinutesPct, seasonMinutes: priorMinutes, balance });
    setPlan(f.id, out.periods, balance);
    setWarnings(out.warnings);
    setSelected(null);
    setPeriodIdx(0);
  };

  const planMinutes = planPeriods ? minutesFromPlan(planPeriods, f.matchMinutes) : {};
  const staleIds = planPeriods ? [...new Set(planPeriods.flat().filter((x): x is string => !!x && !avail.some((p) => p.id === x)))] : [];

  const lineup = planPeriods?.[periodIdx] ?? [];
  const prevLineup = periodIdx > 0 ? planPeriods?.[periodIdx - 1] : undefined;
  const highlight = new Set<number>();
  if (prevLineup) lineup.forEach((pid, i) => pid !== prevLineup[i] && highlight.add(i));
  const bench = avail.filter((p) => !lineup.includes(p.id));
  const perWindow = f.matchMinutes / f.periods;

  const assign = (playerId: string) => {
    if (!planPeriods || selected === null) return;
    const next = planPeriods.map((p) => [...p]);
    const period = next[periodIdx];
    const from = period.indexOf(playerId);
    const displaced = period[selected];
    period[selected] = playerId;
    if (from >= 0) period[from] = displaced;
    setPlan(f.id, next, balance);
    setSelected(null);
  };

  const onSlot = (i: number) => {
    if (played) return;
    if (selected !== null && selected !== i && planPeriods) {
      // swap two on-pitch players
      const pid = lineup[i];
      if (pid) {
        assign(pid);
        return;
      }
    }
    setSelected(selected === i ? null : i);
  };

  const record = () => {
    if (!planPeriods) return;
    completeFixture(f.id, {
      minutes: minutesFromPlan(planPeriods, f.matchMinutes),
      result: { for: goalsFor, against: goalsAgainst },
      starters: planPeriods[0].filter((x): x is string => !!x),
    });
  };

  const startLive = () => {
    if (!planPeriods) generate();
    router.push({ pathname: '/fixture/live', params: { id: f.id } });
  };

  const unanswered = players.filter((p) => !f.availability[p.id] && p.status === 'fit');

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `${f.home ? 'vs' : '@'} ${f.opponent}`,
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/fixture/edit', params: { id: f.id } })} style={{ padding: 8 }}>
              <Txt color={t.primary} style={{ fontWeight: '700' }}>Edit</Txt>
            </Pressable>
          ),
        }}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt v="h2">{f.opponent}</Txt>
          <Txt dim>{formatDate(f.date, true)} · {f.format}-a-side · {formation.name}</Txt>
        </View>
        {played && f.result ? <Txt v="num">{f.result.for}–{f.result.against}</Txt> : null}
      </Row>

      {!played ? (
        <>
          <SectionTitle
            action={
              <Btn
                label="Unanswered → In"
                small
                kind="ghost"
                onPress={() => fitPlayers.forEach((p) => !f.availability[p.id] && setAvailability(f.id, p.id, 'yes'))}
              />
            }
          >
            Availability · {avail.length} in · {unanswered.length} unanswered
          </SectionTitle>
          <Card>
            {players.map((p) => {
              const a = f.availability[p.id] as Availability | undefined;
              const disabled = p.status !== 'fit';
              return (
                <Row key={p.id} style={{ justifyContent: 'space-between' }}>
                  <Row style={{ flex: 1 }}>
                    <Avatar name={p.name} size={28} color={t.pos[p.position]} />
                    <View style={{ flex: 1 }}>
                      <Txt numberOfLines={1} style={{ fontWeight: '600' }}>{p.name}</Txt>
                      {disabled ? <Txt v="small" color={t.bad}>{p.status === 'injured' ? 'Injured' : 'Unavailable'}</Txt> : null}
                    </View>
                  </Row>
                  {disabled ? null : (
                    <Row gap={4}>
                      <Chip label="In" selected={a === 'yes'} color={t.good} onPress={() => setAvailability(f.id, p.id, 'yes')} />
                      <Chip label="?" selected={a === 'maybe'} color={t.warn} onPress={() => setAvailability(f.id, p.id, 'maybe')} />
                      <Chip label="Out" selected={a === 'no'} color={t.bad} onPress={() => setAvailability(f.id, p.id, 'no')} />
                    </Row>
                  )}
                </Row>
              );
            })}
          </Card>

          <SectionTitle>Rotation plan</SectionTitle>
          <Card>
            <Txt v="label">Formation</Txt>
            <Row gap={6} wrap>
              {formationsFor(f.format).map((fm) => (
                <Chip key={fm.id} label={fm.name} selected={fm.id === f.formationId} onPress={() => saveFixture({ id: f.id, opponent: f.opponent, date: f.date, formationId: fm.id, plan: undefined })} />
              ))}
            </Row>
            <Txt v="label">Approach</Txt>
            <Segmented value={BALANCES.reduce((b, x) => (Math.abs(x.value - balance) < Math.abs(b - balance) ? x.value : b), 0.5)} onChange={setBalance} options={BALANCES} />
            <Txt v="small" dim>
              Everyone available gets at least {club.minMinutesPct}% of the match ({Math.ceil((club.minMinutesPct / 100) * f.periods)} of {f.periods} windows).{' '}
              {balance < 0.3 ? 'Players with fewer season minutes get extra time first.' : balance > 0.7 ? 'Stronger players get the extra time beyond the minimum.' : 'Extra time is shared between catch-up and strength.'}
            </Txt>
            {maybeCount > 0 ? (
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="small" style={{ flex: 1 }}>Count the {maybeCount} “maybe” player{maybeCount === 1 ? '' : 's'} as available</Txt>
                <Segmented value={includeMaybe ? 'y' : 'n'} onChange={(v) => setIncludeMaybe(v === 'y')} options={[{ value: 'n', label: 'No' }, { value: 'y', label: 'Yes' }]} />
              </Row>
            ) : null}
            {avail.length < slots.length && avail.length > 0 ? (
              <Txt v="small" color={t.warn}>
                Only {avail.length} available for {slots.length} positions{maybeCount > 0 && !includeMaybe ? ' — try counting the maybes' : ''}.
              </Txt>
            ) : null}
            <Btn label={planPeriods ? 'Regenerate plan' : 'Generate fair plan'} icon="shuffle" onPress={generate} disabled={avail.length === 0} />
            {avail.length === 0 ? <Txt v="small" color={t.warn}>Mark at least one player “In” to plan.</Txt> : null}
            {warnings.map((w) => (
              <Txt key={w} v="small" color={t.warn}>⚠ {w}</Txt>
            ))}
            {staleIds.length > 0 ? (
              <Txt v="small" color={t.bad}>
                ⚠ Plan includes players no longer available: {staleIds.map((x) => byId[x]?.name ?? x).join(', ')}. Regenerate.
              </Txt>
            ) : null}
          </Card>
        </>
      ) : null}

      {planPeriods ? (
        <>
          <SectionTitle>{played ? 'Planned lineup' : 'Window'} {periodIdx + 1} of {f.periods}</SectionTitle>
          <Row gap={6} wrap>
            {planPeriods.map((_, i) => (
              <Chip key={i} label={`${Math.round(i * perWindow)}′`} selected={i === periodIdx} onPress={() => { setPeriodIdx(i); setSelected(null); }} />
            ))}
          </Row>
          <Pitch
            width={pitchWidth}
            slots={slots}
            lineup={lineup}
            players={byId}
            onSlotPress={onSlot}
            highlight={highlight}
            selected={selected}
            badge={(pid) => (prevLineup && !prevLineup.includes(pid) ? 'ON' : undefined)}
          />
          {prevLineup ? (
            <Card>
              <Txt v="label">Changes at {Math.round(periodIdx * perWindow)}′</Txt>
              {(() => {
                const off = prevLineup.filter((x): x is string => !!x && !lineup.includes(x));
                const on = lineup.filter((x): x is string => !!x && !prevLineup.includes(x));
                if (!off.length && !on.length) return <Txt v="small" dim>No substitutions — positions may shift.</Txt>;
                return (
                  <>
                    {off.map((x) => (
                      <Txt key={`o${x}`} v="small" color={t.bad}>▼ {byId[x]?.name}</Txt>
                    ))}
                    {on.map((x) => (
                      <Txt key={`i${x}`} v="small" color={t.good}>▲ {byId[x]?.name}</Txt>
                    ))}
                  </>
                );
              })()}
            </Card>
          ) : null}

          {!played ? (
            <>
              <Txt v="small" dim>
                {selected !== null ? `Choose a player for ${slots[selected].label}:` : 'Tap a position, then a player to adjust manually.'}
              </Txt>
              <Row gap={6} wrap>
                {bench.map((p) => (
                  <Chip
                    key={p.id}
                    label={`${surname(p.name)} · ${p.position}`}
                    color={t.pos[p.position]}
                    selected={false}
                    onPress={() => selected !== null && assign(p.id)}
                  />
                ))}
                {bench.length === 0 ? <Txt v="small" dim>Nobody on the bench this window.</Txt> : null}
              </Row>
            </>
          ) : null}

          <SectionTitle>{played ? 'Minutes played' : 'Fairness preview'}</SectionTitle>
          <Card>
            {(played ? players.filter((p) => (f.minutes?.[p.id] ?? 0) > 0 || f.availability[p.id] === 'yes') : avail)
              .map((p) => ({ p, mins: played ? (f.minutes?.[p.id] ?? 0) : (planMinutes[p.id] ?? 0) }))
              .sort((a, b) => b.mins - a.mins)
              .map(({ p, mins }) => {
                const pct = mins / f.matchMinutes;
                const under = pct < club.minMinutesPct / 100 - 1e-6;
                const before = priorMinutes[p.id] ?? 0;
                return (
                  <View key={p.id} style={{ gap: 3 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{p.name} <Txt v="small" dim>{p.position} · OVR {overall(p)}</Txt></Txt>
                      <Txt style={{ fontWeight: '800' }} color={under ? t.bad : t.text}>{Math.round(mins)}′</Txt>
                      {played ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Explain ${p.name}'s minutes`}
                          onPress={() => {
                            const st = statById[p.id];
                            setExplain(parentExplainer({ player: p, fixture: f, stat: st, club, squadRank: squadRank(stats, p.id), squadSize: players.length }));
                          }}
                          style={{ paddingLeft: 10 }}
                        >
                          <Txt v="small" color={t.primary} style={{ fontWeight: '700' }}>Explain</Txt>
                        </Pressable>
                      ) : null}
                    </Row>
                    <Bar value={pct} marker={club.minMinutesPct / 100} color={under ? t.bad : t.primary} height={6} />
                    {!played ? <Txt v="small" dim>Season so far {Math.round(before)}′ → {Math.round(before + mins)}′ after this match</Txt> : null}
                  </View>
                );
              })}
            <Txt v="small" dim>Marker shows the club’s {club.minMinutesPct}% minimum.</Txt>
          </Card>
          {explain ? (
            <Card tone="good">
              <Txt v="label">Message for parent / player</Txt>
              <Txt style={Platform.OS === 'web' ? ({ userSelect: 'text' } as object) : undefined}>{explain}</Txt>
              <Btn label="Close" small kind="ghost" onPress={() => setExplain(null)} />
            </Card>
          ) : null}
        </>
      ) : null}

      {!played && planPeriods ? (
        <>
          <Btn label="Start live match" icon="play" onPress={startLive} />
          <Card>
            <Txt v="h3">Or record the result now</Txt>
            <Stepper label="Goals for" value={goalsFor} onChange={setGoalsFor} min={0} max={30} step={1} format={(n) => String(n)} />
            <Stepper label="Goals against" value={goalsAgainst} onChange={setGoalsAgainst} min={0} max={30} step={1} format={(n) => String(n)} />
            <Btn label="Mark as played (use plan minutes)" kind="secondary" icon="checkmark-done" onPress={record} />
          </Card>
        </>
      ) : null}

      {played && f.events.length > 0 ? (
        <Card>
          <Txt v="label">Events</Txt>
          {[...f.events]
            .sort((a, b) => a.minute - b.minute)
            .map((e) => (
              <Txt key={e.id} v="small">
                {e.minute}′ {e.type === 'goal' ? '⚽' : '🅰'} {byId[e.playerId]?.name ?? 'Unknown'}
              </Txt>
            ))}
        </Card>
      ) : null}

      {f.status === 'live' ? <Pill label="Match in progress" color={t.bad} solid /> : null}
    </Screen>
  );
}
