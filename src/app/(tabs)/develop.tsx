import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { Avatar, Bar, Btn, Card, Empty, Pill, Row, Screen, SectionTitle, Txt } from '@/ui/kit';
import { Sparkline } from '@/ui/charts';
import { useTheme } from '@/ui/theme';
import { SKILL_LABEL, focusProgress, observationsFor, overall, overallHistory, recentDelta, squadSkillAverages } from '@/domain/ratings';
import { daysBetween, parseDate } from '@/domain/util';

export default function Develop() {
  const t = useTheme();
  const router = useRouter();
  const { players, observations, stats } = useDerived();
  const now = React.useMemo(() => new Date(), []);

  if (players.length === 0) {
    return (
      <Screen>
        <Empty icon="trending-up-outline" title="No players yet" body="Add players and log observations to track development." />
      </Screen>
    );
  }

  const avgs = squadSkillAverages(players).sort((a, b) => a.avg - b.avg);
  const weakest = avgs[0];
  const withFocus = players.filter((p) => p.focus.length > 0);
  const stale = players
    .map((p) => {
      const last = observationsFor(observations, p.id).slice(-1)[0];
      return { p, days: last ? daysBetween(parseDate(last.date), now) : 999 };
    })
    .filter((x) => x.days > 30)
    .sort((a, b) => b.days - a.days);
  const deltas = players.map((p) => ({ p, d: recentDelta(observations, p, 120, now) })).sort((a, b) => b.d - a.d);
  const lowAttendance = stats.filter((s) => s.attendance !== null && s.attendance < 0.7).sort((a, b) => (a.attendance as number) - (b.attendance as number));

  return (
    <Screen>
      <Card tone="good">
        <Txt v="label">Suggested training focus</Txt>
        <Txt v="h2">{SKILL_LABEL[weakest.skill]}</Txt>
        <Txt dim>Lowest squad average ({weakest.avg.toFixed(1)}/10) among outfield players. Next-lowest: {avgs.slice(1, 3).map((a) => SKILL_LABEL[a.skill]).join(', ')}.</Txt>
      </Card>

      <SectionTitle>Squad profile</SectionTitle>
      <Card>
        {[...avgs].reverse().map((a) => (
          <View key={a.skill} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="small">{SKILL_LABEL[a.skill]}</Txt>
              <Txt v="small" style={{ fontWeight: '700' }}>{a.avg.toFixed(1)}</Txt>
            </Row>
            <Bar value={a.avg / 10} color={a.skill === weakest.skill ? t.accent : t.primary} height={7} />
          </View>
        ))}
      </Card>

      {withFocus.length > 0 ? (
        <>
          <SectionTitle>Individual focus goals</SectionTitle>
          <Card>
            {withFocus.map((p) =>
              p.focus.map((s) => {
                const pr = focusProgress(p, observations, s);
                return (
                  <View key={`${p.id}${s}`} style={{ gap: 3 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Row style={{ flex: 1 }}>
                        <Avatar name={p.name} size={26} color={t.pos[p.position]} />
                        <Txt numberOfLines={1} style={{ fontWeight: '600', flex: 1 }} onPress={() => router.push({ pathname: '/player/[id]', params: { id: p.id } })}>
                          {p.name}
                        </Txt>
                      </Row>
                      <Txt v="small">
                        {SKILL_LABEL[s]} {p.ratings[s]}→{p.focusTargets[s] ?? '?'}
                      </Txt>
                    </Row>
                    <Bar value={pr ?? 0} color={(pr ?? 0) >= 1 ? t.good : t.accent} height={6} />
                  </View>
                );
              }),
            )}
          </Card>
        </>
      ) : null}

      <SectionTitle>Momentum (last 4 months)</SectionTitle>
      <Card>
        {[...deltas.slice(0, 3), ...deltas.slice(-2)]
          .filter((x, i, arr) => arr.findIndex((y) => y.p.id === x.p.id) === i)
          .map(({ p, d }) => (
            <Row key={p.id} style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Avatar name={p.name} size={28} color={t.pos[p.position]} />
                <Txt numberOfLines={1} style={{ fontWeight: '600', flex: 1 }} onPress={() => router.push({ pathname: '/player/[id]', params: { id: p.id } })}>{p.name}</Txt>
              </Row>
              <Sparkline values={overallHistory(observations, p).map((h) => h.value)} />
              <Txt style={{ width: 70, textAlign: 'right', fontWeight: '800' }} color={d > 0 ? t.good : d < 0 ? t.bad : t.textDim}>
                {d > 0 ? '+' : ''}{d} → {overall(p)}
              </Txt>
            </Row>
          ))}
      </Card>

      {stale.length > 0 ? (
        <>
          <SectionTitle>Due for assessment</SectionTitle>
          <Card>
            {stale.slice(0, 6).map(({ p, days }) => (
              <Row key={p.id} style={{ justifyContent: 'space-between' }}>
                <Txt style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{p.name}</Txt>
                <Pill label={days >= 999 ? 'never' : `${days}d ago`} color={t.warn} />
                <Btn label="Observe" small kind="ghost" onPress={() => router.push({ pathname: '/player/observe', params: { id: p.id } })} />
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {lowAttendance.length > 0 ? (
        <>
          <SectionTitle>Training attendance below 70%</SectionTitle>
          <Card>
            {lowAttendance.map((s) => (
              <Row key={s.player.id} style={{ justifyContent: 'space-between' }}>
                <Txt style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{s.player.name}</Txt>
                <Txt color={t.warn} style={{ fontWeight: '700' }}>{Math.round((s.attendance as number) * 100)}%</Txt>
              </Row>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
