import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { Avatar, Bar, Btn, Card, Pill, Row, Screen, SectionTitle, Stat, Txt } from '@/ui/kit';
import { Sparkline } from '@/ui/charts';
import { useTheme } from '@/ui/theme';
import { budgetSummary, contractFlag, retentionRisks } from '@/domain/budget';
import { overall, overallHistory, recentDelta } from '@/domain/ratings';
import { formatDate, formatMoney } from '@/domain/util';

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const { club, players, observations, upcoming, played, flags, index } = useDerived();
  const now = React.useMemo(() => new Date(), []);

  const budget = budgetSummary(players, club, now);
  const risks = retentionRisks(players, now).slice(0, 3);
  const movers = players
    .map((p) => ({ p, d: recentDelta(observations, p, 120, now) }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, 3);
  const next = upcoming[0];
  const avail = next ? Object.values(next.availability) : [];
  const yes = avail.filter((a) => a === 'yes').length;
  const maybe = avail.filter((a) => a === 'maybe').length;
  const no = avail.filter((a) => a === 'no').length;
  const unanswered = next ? players.filter((p) => !next.availability[p.id]).length : 0;
  const record = played.reduce(
    (acc, f) => {
      if (!f.result) return acc;
      if (f.result.for > f.result.against) acc.w++;
      else if (f.result.for === f.result.against) acc.d++;
      else acc.l++;
      return acc;
    },
    { w: 0, d: 0, l: 0 },
  );

  if (players.length === 0) {
    return (
      <Screen>
        <Card>
          <Txt v="h2">Welcome to {club.name}</Txt>
          <Txt dim>Start by adding your players — then plan fixtures, rotations and budgets.</Txt>
          <Btn label="Add first player" icon="person-add" onPress={() => router.push('/player/edit')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <Txt v="title">{club.name}</Txt>
        <Txt dim>
          {players.length} players · Record {record.w}W {record.d}D {record.l}L
        </Txt>
      </View>

      {next ? (
        <Card onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: next.id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="label">Next match</Txt>
            {next.plan ? <Pill label="Plan ready" color={t.good} icon="checkmark" /> : <Pill label="No plan yet" color={t.warn} icon="alert" />}
          </Row>
          <Txt v="h2">
            {next.home ? 'vs' : '@'} {next.opponent}
          </Txt>
          <Txt dim>{formatDate(next.date, true)}</Txt>
          <Row gap={6} wrap>
            <Pill label={`${yes} in`} color={t.good} />
            <Pill label={`${maybe} maybe`} color={t.warn} />
            <Pill label={`${no} out`} color={t.bad} />
            {unanswered > 0 ? <Pill label={`${unanswered} unanswered`} color={t.textDim} /> : null}
          </Row>
        </Card>
      ) : (
        <Card>
          <Txt v="h3">No upcoming fixtures</Txt>
          <Btn label="Add fixture" icon="add" onPress={() => router.push('/fixture/edit')} />
        </Card>
      )}

      <Row align="stretch" gap={12} wrap>
        <Card style={{ flex: 1, minWidth: 260 }} onPress={() => router.push('/finance')}>
          <Stat
            label="Wage headroom"
            value={formatMoney(budget.headroom, club.currency)}
            sub={`${Math.round(budget.utilisation * 100)}% of ${formatMoney(budget.annualBudget, club.currency)} used`}
            color={budget.headroom < 0 ? t.bad : budget.utilisation > 0.92 ? t.warn : t.text}
          />
          <Bar value={budget.utilisation} color={budget.utilisation > 1 ? t.bad : budget.utilisation > 0.92 ? t.warn : t.primary} />
        </Card>
        <Card style={{ flex: 1, minWidth: 260 }} onPress={() => router.push('/matchday')}>
          <Stat
            label="Fairness index"
            value={index === null ? '—' : `${index}`}
            sub={index === null ? 'Needs a few played matches' : index >= 80 ? 'Minutes are shared evenly' : index >= 60 ? 'Some players are being squeezed' : 'Minutes are heavily skewed'}
            color={index === null ? t.textDim : index >= 80 ? t.good : index >= 60 ? t.warn : t.bad}
          />
          {index !== null ? <Bar value={index / 100} color={index >= 80 ? t.good : index >= 60 ? t.warn : t.bad} /> : null}
        </Card>
      </Row>

      {flags.length > 0 ? (
        <>
          <SectionTitle>Under the {club.minMinutesPct}% minutes rule</SectionTitle>
          <Card tone="warn">
            {flags.slice(0, 4).map((f) => (
              <Row key={f.player.id} style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Avatar name={f.player.name} size={32} color={t.pos[f.player.position]} />
                  <Txt v="h3" numberOfLines={1} style={{ flex: 1 }}>{f.player.name}</Txt>
                </Row>
                <Txt color={t.warn} style={{ fontWeight: '700' }}>{Math.round(f.share * 100)}% · {Math.round(f.minutes)}′</Txt>
              </Row>
            ))}
            <Txt v="small" dim>The rotation planner will prioritise these players in the next plan.</Txt>
            {next ? <Btn label="Plan next match" small icon="shuffle" onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: next.id } })} /> : null}
          </Card>
        </>
      ) : null}

      {risks.length > 0 ? (
        <>
          <SectionTitle>Contracts to act on</SectionTitle>
          <Card>
            {risks.map((r) => {
              const cf = contractFlag(r.player, now);
              return (
                <Row key={r.player.id} style={{ justifyContent: 'space-between' }} >
                  <Row style={{ flex: 1 }}>
                    <Avatar name={r.player.name} size={32} color={t.pos[r.player.position]} />
                    <View style={{ flex: 1 }}>
                      <Txt v="h3" numberOfLines={1}>{r.player.name}</Txt>
                      <Txt v="small" dim>OVR {r.ovr} · {formatMoney(r.player.contract?.annualWage ?? 0, club.currency)}/yr</Txt>
                    </View>
                  </Row>
                  <Pill label={cf.daysLeft! < 0 ? 'Expired' : `${cf.daysLeft} days`} color={cf.flag === 'critical' || cf.flag === 'expired' ? t.bad : t.warn} />
                </Row>
              );
            })}
            <Btn label="Open Finance" kind="ghost" small onPress={() => router.push('/finance')} />
          </Card>
        </>
      ) : null}

      {movers.length > 0 ? (
        <>
          <SectionTitle>Development movers (4 months)</SectionTitle>
          <Card>
            {movers.map(({ p, d }) => (
              <Row key={p.id} style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Avatar name={p.name} size={32} color={t.pos[p.position]} />
                  <Txt v="h3" numberOfLines={1} style={{ flex: 1 }} >{p.name}</Txt>
                </Row>
                <Sparkline values={overallHistory(observations, p).map((x) => x.value)} />
                <Txt style={{ width: 54, textAlign: 'right', fontWeight: '800' }} color={d >= 0 ? t.good : t.bad}>
                  {d > 0 ? '+' : ''}{d} <Txt v="small" dim>{overall(p)}</Txt>
                </Txt>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Quick actions</SectionTitle>
      <Row wrap>
        <Btn label="Add player" icon="person-add" kind="secondary" small onPress={() => router.push('/player/edit')} />
        <Btn label="Add fixture" icon="calendar" kind="secondary" small onPress={() => router.push('/fixture/edit')} />
        <Btn label="Scenario lab" icon="flask" kind="secondary" small onPress={() => router.push('/scenario')} />
      </Row>
      {played[0] ? (
        <Txt v="small" dim>
          Last result: {played[0].home ? 'vs' : '@'} {played[0].opponent}
          {played[0].result ? ` ${played[0].result.for}–${played[0].result.against}` : ''}
        </Txt>
      ) : null}
    </Screen>
  );
}
