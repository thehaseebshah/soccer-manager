import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { useClub } from '@/store/useClub';
import { Bar, Btn, Card, Chip, Field, Row, Screen, SectionTitle, Segmented, Stat, Txt, confirmAction } from '@/ui/kit';
import { BudgetChart } from '@/ui/charts';
import { MAX_W, useTheme } from '@/ui/theme';
import { POS_GROUPS, type PosGroup } from '@/domain/types';
import { monthlyProjection, runScenario, type ScenarioOp } from '@/domain/budget';
import { overall } from '@/domain/ratings';
import { formatMoney, uid } from '@/domain/util';

type Kind = 'release' | 'renew' | 'sign';

export default function Scenario() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { club, players } = useDerived();
  const savePlayer = useClub((s) => s.savePlayer);
  const deletePlayer = useClub((s) => s.deletePlayer);
  const now = React.useMemo(() => new Date(), []);

  const [ops, setOps] = React.useState<(ScenarioOp & { key: string })[]>([]);
  const [kind, setKind] = React.useState<Kind>('release');
  const [pid, setPid] = React.useState<string | undefined>();
  const [payoff, setPayoff] = React.useState('50');
  const [wage, setWage] = React.useState('');
  const [years, setYears] = React.useState('2');
  const [name, setName] = React.useState('');
  const [pos, setPos] = React.useState<PosGroup>('MID');
  const [age, setAge] = React.useState('24');
  const [rating, setRating] = React.useState('65');
  const [fee, setFee] = React.useState('0');

  const num = (s: string) => (Number.isFinite(Number(s)) && s.trim() !== '' ? Number(s) : NaN);

  const result = React.useMemo(() => runScenario(players, club, ops, now), [players, club, ops, now]);
  const baseline = React.useMemo(() => monthlyProjection(players, club, now, 24), [players, club, now]);

  const canAdd =
    kind === 'sign'
      ? name.trim() && num(wage) >= 0 && num(years) > 0 && num(age) > 0 && num(rating) > 0
      : kind === 'release'
        ? !!pid && num(payoff) >= 0
        : !!pid && num(wage) >= 0 && num(years) > 0;

  const add = () => {
    if (!canAdd) return;
    const key = uid();
    if (kind === 'release') setOps((o) => [...o, { key, type: 'release', playerId: pid!, payoffPct: num(payoff) }]);
    else if (kind === 'renew') setOps((o) => [...o, { key, type: 'renew', playerId: pid!, newAnnualWage: num(wage), years: num(years) }]);
    else
      setOps((o) => [
        ...o,
        { key, type: 'sign', name: name.trim(), position: pos, age: num(age), rating: num(rating), annualWage: num(wage), years: num(years), fee: num(fee) || 0 },
      ]);
    setPid(undefined);
    setName('');
  };

  const apply = () =>
    confirmAction('Apply scenario?', 'This changes your real squad and contracts. It cannot be undone automatically.', () => {
      const current = new Map(players.map((p) => [p.id, p]));
      result.squadAfter.forEach((p) => {
        const before = current.get(p.id);
        if (!before) savePlayer({ ...p, id: undefined });
        else if (JSON.stringify(before.contract) !== JSON.stringify(p.contract)) savePlayer(p);
      });
      players.forEach((p) => {
        if (!result.squadAfter.some((x) => x.id === p.id)) deletePlayer(p.id);
      });
      setOps([]);
      router.back();
    });

  const label = (o: ScenarioOp) => {
    const p = 'playerId' in o ? players.find((x) => x.id === o.playerId) : undefined;
    if (o.type === 'release') return `Release ${p?.name ?? '?'} (pay ${o.payoffPct}% of remaining wages)`;
    if (o.type === 'renew') return `Renew ${p?.name ?? '?'} at ${formatMoney(o.newAnnualWage, club.currency)}/yr for ${o.years} yrs`;
    return `Sign ${o.name} (${o.position}, ${o.age}y, OVR ${o.rating}) at ${formatMoney(o.annualWage, club.currency)}/yr, fee ${formatMoney(o.fee, club.currency)}`;
  };

  const chartW = Math.min(width, MAX_W) - 64;

  return (
    <Screen>
      <Txt dim>
        Stack up releases, renewals and signings and see the effect on the wage bill, the squad shape and your 24-month budget — before committing to anything.
      </Txt>

      <Card>
        <Segmented<Kind> value={kind} onChange={(k) => { setKind(k); setPid(undefined); }} options={[{ value: 'release', label: 'Release' }, { value: 'renew', label: 'Renew' }, { value: 'sign', label: 'Sign' }]} />
        {kind !== 'sign' ? (
          <>
            <Txt v="label">Player</Txt>
            <Row gap={6} wrap>
              {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={pid === p.id}
                  color={t.pos[p.position]}
                  onPress={() => {
                    setPid(p.id);
                    if (kind === 'renew') setWage(String(p.contract?.annualWage ?? 0));
                  }}
                />
              ))}
            </Row>
          </>
        ) : (
          <>
            <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Segmented value={pos} onChange={setPos} options={POS_GROUPS.map((g) => ({ value: g, label: g }))} />
            <Row align="flex-start">
              <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
              <Field label="Overall (0–100)" value={rating} onChangeText={setRating} keyboardType="number-pad" />
            </Row>
          </>
        )}
        {kind === 'release' ? (
          <Field label="Payoff (% of remaining wages)" value={payoff} onChangeText={setPayoff} keyboardType="decimal-pad" />
        ) : (
          <Row align="flex-start">
            <Field label={`Annual wage (${club.currency})`} value={wage} onChangeText={setWage} keyboardType="decimal-pad" />
            <Field label="Years" value={years} onChangeText={setYears} keyboardType="decimal-pad" />
            {kind === 'sign' ? <Field label="Fee" value={fee} onChangeText={setFee} keyboardType="decimal-pad" /> : null}
          </Row>
        )}
        <Btn label="Add to scenario" icon="add" disabled={!canAdd} onPress={add} />
      </Card>

      {ops.length > 0 ? (
        <>
          <SectionTitle action={<Btn label="Clear" small kind="ghost" onPress={() => setOps([])} />}>Scenario ({ops.length})</SectionTitle>
          <Card>
            {ops.map((o) => (
              <Row key={o.key} style={{ justifyContent: 'space-between' }}>
                <Txt v="small" style={{ flex: 1 }}>{label(o)}</Txt>
                <Btn label="Remove" small kind="ghost" onPress={() => setOps((x) => x.filter((y) => y.key !== o.key))} />
              </Row>
            ))}
          </Card>

          <SectionTitle>Outcome</SectionTitle>
          <Card tone={result.warnings.length ? 'warn' : 'good'}>
            <Row wrap gap={16}>
              <Stat
                label="Wage bill"
                value={formatMoney(result.after.annualCommitted, club.currency)}
                sub={`${result.firstYearImpact >= 0 ? '+' : ''}${formatMoney(result.firstYearImpact, club.currency)} vs now`}
                color={result.after.utilisation > 1 ? t.bad : undefined}
              />
              <Stat label="Headroom" value={formatMoney(result.after.headroom, club.currency)} sub={`${Math.round(result.after.utilisation * 100)}% used`} />
              <Stat label="One-off cost" value={formatMoney(result.oneOffCost, club.currency)} sub="fees + payoffs" />
              <Stat
                label="Squad OVR"
                value={`${result.avgOverallAfter}`}
                sub={`${result.avgOverallAfter - result.avgOverallBefore >= 0 ? '+' : ''}${result.avgOverallAfter - result.avgOverallBefore} vs now`}
              />
            </Row>
            <Bar value={result.after.utilisation} color={result.after.utilisation > 1 ? t.bad : t.primary} />
            {result.warnings.map((w) => (
              <Txt key={w} v="small" color={t.warn}>⚠ {w}</Txt>
            ))}
            {result.warnings.length === 0 ? <Txt v="small" color={t.good}>No problems detected.</Txt> : null}
          </Card>

          <Card>
            <Txt v="label">24-month wage bill (yellow ticks = current squad)</Txt>
            <BudgetChart months={result.projectionAfter} compareTo={baseline} width={Math.max(chartW, 240)} />
            <View style={{ gap: 4 }}>
              {result.depthAfter.map((d) => (
                <Row key={d.pos} style={{ justifyContent: 'space-between' }}>
                  <Txt v="small">{d.pos}</Txt>
                  <Txt v="small" color={d.gap < -1 ? t.warn : t.textDim}>{d.have} / {d.need} ideal</Txt>
                </Row>
              ))}
            </View>
          </Card>
          <Btn label="Apply to my squad" icon="checkmark-done" kind="secondary" onPress={apply} />
        </>
      ) : (
        <Txt dim center>Add a move above to see its impact.</Txt>
      )}
      <Txt v="small" dim center>Best OVR in squad today: {players.length ? Math.max(...players.map(overall)) : '—'}</Txt>
    </Screen>
  );
}
