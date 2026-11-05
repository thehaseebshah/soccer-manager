import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { useClub } from '@/store/useClub';
import { Btn, Card, Chip, Empty, Pill, Row, Screen, Txt, confirmAction } from '@/ui/kit';
import { Pitch, surname } from '@/ui/Pitch';
import { useTheme } from '@/ui/theme';
import { buildSlots, getFormation } from '@/domain/lineup';
import { applyLineup, clockLabel, elapsedMs, finish, liveMinutes, newLive, pause, periodBoundaryMs, start, substitute } from '@/domain/live';
import type { LiveState } from '@/domain/types';

export default function LiveMatch() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useClub((s) => s.fixtures.find((x) => x.id === id));
  const { byId, players } = useDerived();
  const setLive = useClub((s) => s.setLive);
  const addEvent = useClub((s) => s.addEvent);
  const removeEvent = useClub((s) => s.removeEvent);
  const saveFixture = useClub((s) => s.saveFixture);
  const completeFixture = useClub((s) => s.completeFixture);

  const [now, setNow] = React.useState(() => Date.now());
  const [selected, setSelected] = React.useState<number | null>(null);
  const live: LiveState | undefined = f?.live;

  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, []);

  // initialise live state from the first planned window
  React.useEffect(() => {
    if (f && !f.live && f.plan) setLive(f.id, newLive(f.plan.periods[0]), 'live');
  }, [f, setLive]);

  if (!f || !f.plan) {
    return (
      <Screen>
        <Empty icon="warning-outline" title="No plan to run" body="Generate a rotation plan first." action={<Btn label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  if (!live) return null;

  const slots = buildSlots(getFormation(f.formationId, f.format));
  const elapsed = elapsedMs(live, now);
  const matchMs = f.matchMinutes * 60000;
  const nextIdx = live.periodIndex + 1;
  const hasNext = nextIdx < f.plan.periods.length;
  const nextBoundary = hasNext ? periodBoundaryMs(f.periods, f.matchMinutes, nextIdx) : null;
  const due = nextBoundary !== null && elapsed >= nextBoundary;
  const nextLineup = hasNext ? f.plan.periods[nextIdx] : null;
  const off = nextLineup ? live.slots.filter((x): x is string => !!x && !nextLineup.includes(x)) : [];
  const on = nextLineup ? nextLineup.filter((x): x is string => !!x && !live.slots.includes(x)) : [];
  const bench = players.filter((p) => f.availability[p.id] === 'yes' && p.status === 'fit' && !live.slots.includes(p.id));
  const goalsFor = f.events.filter((e) => e.type === 'goal').length;
  const against = f.result?.against ?? 0;
  const minute = Math.floor(elapsed / 60000) + 1;

  const commit = (l: LiveState) => setLive(f.id, l, l.status === 'done' ? 'played' : 'live');

  const selId = selected !== null ? live.slots[selected] : null;
  const selPlayer = selId ? byId[selId] : undefined;

  const end = () =>
    confirmAction('Full time?', 'This saves minutes and the result to the season record.', () => {
      const { live: done, minutes } = finish(live, Date.now());
      completeFixture(f.id, {
        minutes,
        result: { for: goalsFor, against },
        starters: live.starters ?? f.plan!.periods[0].filter((x): x is string => !!x),
        live: done,
      });
      router.replace({ pathname: '/fixture/[id]', params: { id: f.id } });
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: `${f.home ? 'vs' : '@'} ${f.opponent}` }} />

      <Card tone={live.status === 'running' ? 'good' : undefined}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt v="label">{live.status === 'idle' ? 'Ready' : live.status === 'running' ? 'In play' : 'Paused'}</Txt>
            <Txt v="title" style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}>{clockLabel(elapsed)}</Txt>
            <Txt v="small" dim>of {f.matchMinutes}′{elapsed > matchMs ? ` (+${Math.floor((elapsed - matchMs) / 60000)})` : ''}</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt v="num" style={{ fontSize: 36 }}>{goalsFor}–{against}</Txt>
            <Row gap={6}>
              <Btn label="Conceded" small kind="ghost" icon="add" onPress={() => saveFixture({ id: f.id, opponent: f.opponent, date: f.date, result: { for: goalsFor, against: against + 1 } })} />
              {against > 0 ? <Btn label="" small kind="ghost" icon="remove" onPress={() => saveFixture({ id: f.id, opponent: f.opponent, date: f.date, result: { for: goalsFor, against: against - 1 } })} /> : null}
            </Row>
          </View>
        </Row>
        <Row>
          {live.status === 'running' ? (
            <Btn label="Pause" icon="pause" kind="secondary" onPress={() => commit(pause(live, Date.now()))} style={{ flex: 1 }} />
          ) : (
            <Btn label={live.status === 'idle' ? 'Kick off' : 'Resume'} icon="play" onPress={() => commit(start(live, Date.now()))} style={{ flex: 1 }} />
          )}
          <Btn label="Full time" icon="flag" kind={elapsed >= matchMs ? 'primary' : 'ghost'} onPress={end} style={{ flex: 1 }} />
        </Row>
      </Card>

      {nextLineup ? (
        <Card tone={due ? 'warn' : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="h3">Next window · {Math.round(nextBoundary! / 60000)}′</Txt>
            {due ? <Pill label="DUE NOW" color={t.warn} solid /> : <Pill label={`in ${clockLabel(Math.max(0, nextBoundary! - elapsed))}`} />}
          </Row>
          {off.length + on.length === 0 ? <Txt v="small" dim>No substitutions — positions may shift.</Txt> : null}
          {off.map((x) => (
            <Txt key={`o${x}`} v="small" color={t.bad}>▼ {byId[x]?.name}</Txt>
          ))}
          {on.map((x) => (
            <Txt key={`i${x}`} v="small" color={t.good}>▲ {byId[x]?.name}</Txt>
          ))}
          <Btn
            label="Make planned changes"
            icon="swap-horizontal"
            kind={due ? 'primary' : 'secondary'}
            onPress={() => {
              commit(applyLineup(live, nextLineup, Date.now(), nextIdx));
              setSelected(null);
            }}
          />
        </Card>
      ) : (
        <Txt v="small" dim center>Final window — no more planned changes.</Txt>
      )}

      <Pitch
        width={Math.min(width - 32, 400)}
        slots={slots}
        lineup={live.slots}
        players={byId}
        selected={selected}
        onSlotPress={(i) => setSelected(selected === i ? null : i)}
        badge={(pid) => `${Math.round(liveMinutes(live, pid, now))}′`}
      />

      {selPlayer && selected !== null ? (
        <Card>
          <Txt v="h3">{selPlayer.name}</Txt>
          <Row wrap>
            <Btn
              label="Goal"
              icon="football"
              small
              onPress={() => {
                addEvent(f.id, { playerId: selPlayer.id, type: 'goal', minute });
                setSelected(null);
              }}
            />
            <Btn
              label="Assist"
              icon="hand-right"
              small
              kind="secondary"
              onPress={() => {
                addEvent(f.id, { playerId: selPlayer.id, type: 'assist', minute });
                setSelected(null);
              }}
            />
          </Row>
          <Txt v="label">Substitute with</Txt>
          <Row gap={6} wrap>
            {bench.map((p) => (
              <Chip
                key={p.id}
                label={`${surname(p.name)} · ${Math.round(liveMinutes(live, p.id, now))}′`}
                color={t.pos[p.position]}
                onPress={() => {
                  commit(substitute(live, selected, p.id, Date.now()));
                  setSelected(null);
                }}
              />
            ))}
            {bench.length === 0 ? <Txt v="small" dim>Bench is empty.</Txt> : null}
          </Row>
        </Card>
      ) : (
        <Txt v="small" dim center>Tap a player to log a goal, an assist or make a substitution.</Txt>
      )}

      {f.events.length > 0 ? (
        <Card>
          <Txt v="label">Events</Txt>
          {f.events.map((e) => (
            <Row key={e.id} style={{ justifyContent: 'space-between' }}>
              <Txt v="small">{e.minute}′ {e.type === 'goal' ? '⚽ Goal' : '🅰 Assist'} — {byId[e.playerId]?.name}</Txt>
              <Btn label="Undo" small kind="ghost" onPress={() => removeEvent(f.id, e.id)} />
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
