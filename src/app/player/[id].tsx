import React from 'react';
import { Platform, Share, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { useClub } from '@/store/useClub';
import { Avatar, Bar, Btn, Card, Divider, Empty, Pill, Row, Screen, SectionTitle, Segmented, Stat, Txt, confirmAction, notify } from '@/ui/kit';
import { Sparkline } from '@/ui/charts';
import { useTheme } from '@/ui/theme';
import { SKILLS, type PlayerStatus } from '@/domain/types';
import { SKILL_LABEL, focusProgress, observationsFor, overall, overallHistory, projectOverall } from '@/domain/ratings';
import { contractFlag } from '@/domain/budget';
import { squadRank } from '@/domain/fairness';
import { playerReport } from '@/domain/report';
import { ageOn, formatDate, formatMoney } from '@/domain/util';

export default function PlayerScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { club, byId, statById, stats, observations, played, players } = useDerived();
  const savePlayer = useClub((s) => s.savePlayer);
  const deletePlayer = useClub((s) => s.deletePlayer);
  const now = React.useMemo(() => new Date(), []);
  const [report, setReport] = React.useState<string | null>(null);

  const p = id ? byId[id] : undefined;
  if (!p) {
    return (
      <Screen>
        <Empty icon="person-remove" title="Player not found" action={<Btn label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  const st = statById[p.id];
  const hist = overallHistory(observations, p);
  const obs = observationsFor(observations, p.id).reverse();
  const cf = contractFlag(p, now);
  const lastMatches = played.slice(0, 8).reverse();

  const setStatus = (status: PlayerStatus) => savePlayer({ ...p, status, statusNote: status === 'fit' ? undefined : p.statusNote });

  const makeReport = async () => {
    const text = playerReport({ player: p, club, stat: st, observations, on: now, rank: squadRank(stats, p.id), squadSize: players.length });
    setReport(text);
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ message: text });
      } catch {
        /* user cancelled */
      }
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <Row gap={14}>
        <Avatar name={p.name} size={64} color={t.pos[p.position]} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="h2">{p.name}</Txt>
          <Row gap={6} wrap>
            <Pill label={p.position} color={t.pos[p.position]} solid />
            {p.altPosition ? <Pill label={`also ${p.altPosition}`} color={t.pos[p.altPosition]} /> : null}
            <Pill label={`${ageOn(p.dob, now)} yrs`} />
            <Pill label={p.foot === 'B' ? 'Both feet' : p.foot === 'L' ? 'Left foot' : 'Right foot'} />
          </Row>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Txt v="num">{overall(p)}</Txt>
          <Txt v="label">OVR</Txt>
        </View>
      </Row>

      <Segmented<PlayerStatus>
        value={p.status}
        onChange={setStatus}
        options={[
          { value: 'fit', label: 'Fit' },
          { value: 'injured', label: 'Injured' },
          { value: 'unavailable', label: 'Unavailable' },
        ]}
      />

      <Card>
        <Row wrap gap={16}>
          <Stat label="Minutes" value={`${Math.round(st?.minutes ?? 0)}′`} sub={st?.share != null ? `${Math.round(st.share * 100)}% of available` : 'no data'} color={st?.share != null && st.share < club.minMinutesPct / 100 ? t.warn : undefined} />
          <Stat label="Apps" value={`${st?.apps ?? 0}`} sub={`${st?.starts ?? 0} starts`} />
          <Stat label="G / A" value={`${st?.goals ?? 0} / ${st?.assists ?? 0}`} />
          <Stat label="Training" value={st?.attendance != null ? `${Math.round(st.attendance * 100)}%` : '—'} sub="attendance" />
        </Row>
      </Card>

      {lastMatches.length > 0 ? (
        <>
          <SectionTitle>Minutes by match</SectionTitle>
          <Card>
            {lastMatches.map((f) => {
              const m = f.minutes?.[p.id] ?? 0;
              const a = f.availability[p.id];
              return (
                <View key={f.id} style={{ gap: 3 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="small">{formatDate(f.date)} · {f.home ? 'vs' : '@'} {f.opponent}</Txt>
                    <Txt v="small" style={{ fontWeight: '700' }}>{a === 'no' && m === 0 ? 'unavailable' : `${Math.round(m)}′`}</Txt>
                  </Row>
                  <Bar value={m / f.matchMinutes} color={m === 0 ? t.border : t.primary} height={6} />
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle action={<Btn label="Observation" icon="add" small kind="secondary" onPress={() => router.push({ pathname: '/player/observe', params: { id: p.id } })} />}>
        Development
      </SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt v="label">Trend</Txt>
            <Txt v="small" dim>Projected OVR in 2 yrs: {projectOverall(p, 2, now)} (age-curve heuristic)</Txt>
          </View>
          <Sparkline values={hist.map((h) => h.value)} width={120} height={36} />
        </Row>
        <Divider />
        {SKILLS.filter((s) => s !== 'goalkeeping' || p.position === 'GK').map((s) => {
          const isFocus = p.focus.includes(s);
          const target = p.focusTargets[s];
          const prog = focusProgress(p, observations, s);
          return (
            <View key={s} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="small" style={{ fontWeight: isFocus ? '800' : '400' }}>
                  {isFocus ? '★ ' : ''}{SKILL_LABEL[s]}
                </Txt>
                <Txt v="small" style={{ fontWeight: '700' }}>
                  {p.ratings[s]}{target ? ` → ${target}` : ''}{prog !== null ? `  (${Math.round(prog * 100)}%)` : ''}
                </Txt>
              </Row>
              <Bar value={p.ratings[s] / 10} marker={target ? target / 10 : undefined} color={isFocus ? t.accent : t.primary} height={7} />
            </View>
          );
        })}
      </Card>

      {obs.length > 0 ? (
        <Card>
          <Txt v="label">Observation log</Txt>
          {obs.slice(0, 5).map((o) => (
            <View key={o.id} style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="small" style={{ fontWeight: '700' }}>{formatDate(o.date)}</Txt>
                <Pill label={o.kind} />
              </Row>
              {o.note ? <Txt v="small" dim>{o.note}</Txt> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <SectionTitle>Contract</SectionTitle>
      <Card>
        {p.contract ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt v="h3">{formatMoney(p.contract.annualWage, club.currency, false)} / year</Txt>
              <Txt v="small" dim>
                {formatDate(p.contract.start)} → {formatDate(p.contract.end)}
              </Txt>
            </View>
            <Pill
              label={cf.flag === 'expired' ? 'Expired' : `${cf.daysLeft} days left`}
              color={cf.flag === 'expired' || cf.flag === 'critical' ? t.bad : cf.flag === 'soon' ? t.warn : t.good}
            />
          </Row>
        ) : (
          <Txt dim>No contract on file (unpaid / registration only).</Txt>
        )}
      </Card>

      <Row wrap>
        <Btn label="Edit player" icon="create" kind="secondary" onPress={() => router.push({ pathname: '/player/edit', params: { id: p.id } })} />
        <Btn label="Progress report" icon="share-outline" kind="secondary" onPress={makeReport} />
      </Row>

      {report ? (
        <Card>
          <Txt v="label">Report (select to copy)</Txt>
          <Txt v="small" style={{ ...(Platform.OS === 'web' ? ({ userSelect: 'text' } as object) : {}) }}>{report}</Txt>
          {Platform.OS !== 'web' ? null : (
            <Btn
              label="Share"
              small
              kind="ghost"
              onPress={async () => {
                const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : undefined;
                if (nav?.share) {
                  try {
                    await nav.share({ text: report });
                  } catch {
                    /* cancelled */
                  }
                } else {
                  notify('Select the text above and copy it.');
                }
              }}
            />
          )}
        </Card>
      ) : null}

      <Btn
        label="Delete player"
        kind="danger"
        icon="trash"
        onPress={() =>
          confirmAction('Delete player?', `${p.name} and their observations will be removed. Match minutes stay in past fixtures.`, () => {
            deletePlayer(p.id);
            router.back();
          })
        }
      />
    </Screen>
  );
}
