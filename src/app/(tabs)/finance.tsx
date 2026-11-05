import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { Avatar, Bar, Btn, Card, Pill, Row, Screen, SectionTitle, Stat, Txt } from '@/ui/kit';
import { BudgetChart } from '@/ui/charts';
import { useTheme, MAX_W } from '@/ui/theme';
import { budgetSummary, contractFlag, depthChart, monthlyProjection, retentionRisks, squadAgeProfile, strengthOutlook } from '@/domain/budget';
import { overall } from '@/domain/ratings';
import { formatDate, formatMoney } from '@/domain/util';

export default function Finance() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { club, players } = useDerived();
  const now = React.useMemo(() => new Date(), []);
  const s = budgetSummary(players, club, now);
  const months = monthlyProjection(players, club, now, 24);
  const risks = retentionRisks(players, now);
  const depth = depthChart(players, club.defaultFormat);
  const age = squadAgeProfile(players, now);
  const outlook = strengthOutlook(players, now);
  const chartW = Math.min(width, MAX_W) - 64;
  const lowest = months.reduce((m, x) => (x.committed < m.committed ? x : m), months[0]);

  const contracts = players
    .filter((p) => p.contract)
    .map((p) => ({ p, cf: contractFlag(p, now) }))
    .sort((a, b) => (a.cf.daysLeft ?? 0) - (b.cf.daysLeft ?? 0));

  const color = s.utilisation > 1 ? t.bad : s.utilisation > 0.92 ? t.warn : t.primary;

  return (
    <Screen>
      <Card>
        <Row wrap gap={16}>
          <Stat label="Wage bill" value={formatMoney(s.annualCommitted, club.currency)} sub={`${s.playersOnContract} contracts · avg ${formatMoney(s.avgWage, club.currency)}`} />
          <Stat label="Headroom" value={formatMoney(s.headroom, club.currency)} sub={`of ${formatMoney(s.annualBudget, club.currency)} budget`} color={s.headroom < 0 ? t.bad : undefined} />
        </Row>
        <Bar value={s.utilisation} color={color} />
        <Txt v="small" dim>{Math.round(s.utilisation * 100)}% of the annual wage budget is committed.</Txt>
      </Card>

      <Btn label="Open scenario lab" icon="flask" onPress={() => router.push('/scenario')} />

      <SectionTitle>Next 24 months (monthly wage bill)</SectionTitle>
      <Card>
        <BudgetChart months={months} width={Math.max(chartW, 240)} />
        <Txt v="small" dim>
          Bars are committed wages; the dashed line is your budget. Contracts expiring will free up to {formatMoney((months[0].committed - lowest.committed) * 12, club.currency)} a year by {lowest.month} if nobody is renewed.
        </Txt>
      </Card>

      <SectionTitle>Contracts</SectionTitle>
      <Card>
        {contracts.map(({ p, cf }) => (
          <Row key={p.id} style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <Avatar name={p.name} size={30} color={t.pos[p.position]} />
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1} style={{ fontWeight: '600' }}>{p.name}</Txt>
                <Txt v="small" dim>{formatMoney(p.contract!.annualWage, club.currency)}/yr · ends {formatDate(p.contract!.end)}</Txt>
              </View>
            </Row>
            <Pill
              label={cf.flag === 'expired' ? 'Expired' : `${cf.daysLeft}d`}
              color={cf.flag === 'expired' || cf.flag === 'critical' ? t.bad : cf.flag === 'soon' ? t.warn : t.good}
            />
          </Row>
        ))}
        {contracts.length === 0 ? <Txt dim>No contracts yet.</Txt> : null}
      </Card>

      {risks.length > 0 ? (
        <>
          <SectionTitle>Retention risks</SectionTitle>
          <Card tone="warn">
            <Txt v="small" dim>Ranked by rating × how soon the contract ends.</Txt>
            {risks.slice(0, 5).map((r) => (
              <Row key={r.player.id} style={{ justifyContent: 'space-between' }}>
                <Txt style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{r.player.name}</Txt>
                <Txt v="small" dim>OVR {r.ovr}</Txt>
                <Txt v="small" color={t.warn} style={{ width: 70, textAlign: 'right', fontWeight: '700' }}>{r.daysLeft < 0 ? 'expired' : `${r.daysLeft} days`}</Txt>
                <Btn label="Renew?" small kind="ghost" onPress={() => router.push('/scenario')} />
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Squad shape</SectionTitle>
      <Card>
        {depth.map((d) => (
          <View key={d.pos} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="small" style={{ fontWeight: '700' }}>{d.pos}</Txt>
              <Txt v="small" color={d.gap < 0 ? t.warn : t.textDim}>{d.have} / {d.need} ideal{d.gap < 0 ? ` (${d.gap})` : ''}</Txt>
            </Row>
            <Bar value={d.have / d.need} color={d.gap < 0 ? t.warn : t.pos[d.pos]} height={6} />
          </View>
        ))}
        <Txt v="small" dim>
          Ages: {Object.entries(age).map(([k, v]) => `${k}: ${v}`).join(' · ')}. Average OVR {outlook.now} today, ~{outlook.in2} in two years (age-curve heuristic).
        </Txt>
      </Card>
      <Txt v="small" dim center>Top earner: {players.length ? [...players].sort((a, b) => (b.contract?.annualWage ?? 0) - (a.contract?.annualWage ?? 0))[0].name : '—'} · Best player: {players.length ? [...players].sort((a, b) => overall(b) - overall(a))[0].name : '—'}</Txt>
    </Screen>
  );
}
