import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useClub } from '@/store/useClub';
import { Btn, Card, Chip, Field, Row, Screen, Segmented, Stepper, Txt } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { POS_GROUPS, SKILLS, type Contract, type Player, type PosGroup, type Skill } from '@/domain/types';
import { SKILL_LABEL, blankRatings } from '@/domain/ratings';
import { addMonths, isValidDate, toISODate } from '@/domain/util';

export default function PlayerEdit() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useClub((s) => s.players.find((p) => p.id === id));
  const club = useClub((s) => s.club);
  const savePlayer = useClub((s) => s.savePlayer);
  const today = React.useMemo(() => new Date(), []);

  const [name, setName] = React.useState(existing?.name ?? '');
  const [dob, setDob] = React.useState(existing?.dob ?? '');
  const [position, setPosition] = React.useState<PosGroup>(existing?.position ?? 'MID');
  const [alt, setAlt] = React.useState<PosGroup | undefined>(existing?.altPosition);
  const [shirt, setShirt] = React.useState(existing?.shirt ? String(existing.shirt) : '');
  const [foot, setFoot] = React.useState<Player['foot']>(existing?.foot ?? 'R');
  const [guardian, setGuardian] = React.useState(existing?.guardian ?? '');
  const [hasContract, setHasContract] = React.useState(!!existing?.contract || !existing);
  const [wage, setWage] = React.useState(existing?.contract ? String(existing.contract.annualWage) : '0');
  const [start, setStart] = React.useState(existing?.contract?.start ?? toISODate(today));
  const [end, setEnd] = React.useState(existing?.contract?.end ?? toISODate(addMonths(today, 12)));
  const [ratings, setRatings] = React.useState(existing?.ratings ?? blankRatings(5));
  const [focus, setFocus] = React.useState<Skill[]>(existing?.focus ?? []);
  const [targets, setTargets] = React.useState<Player['focusTargets']>(existing?.focusTargets ?? {});
  const [tried, setTried] = React.useState(false);

  const when = (cond: boolean, msg: string): string | undefined => (cond ? msg : undefined);
  const errors = {
    name: when(!name.trim(), 'Name is required'),
    dob: when(!isValidDate(dob), 'Use YYYY-MM-DD'),
    wage: when(hasContract && (!/^\d+(\.\d+)?$/.test(wage) || Number(wage) < 0), 'Enter a number'),
    start: when(hasContract && !isValidDate(start), 'Use YYYY-MM-DD'),
    end: when(hasContract && !isValidDate(end), 'Use YYYY-MM-DD') ?? when(hasContract && end < start, 'End is before start'),
    shirt: when(!!shirt && !/^\d{1,2}$/.test(shirt), '0–99'),
  };
  const valid = !Object.values(errors).some(Boolean);

  const toggleFocus = (s: Skill) => {
    setFocus((f) => (f.includes(s) ? f.filter((x) => x !== s) : f.length >= 3 ? f : [...f, s]));
  };

  const save = () => {
    setTried(true);
    if (!valid) return;
    const contract: Contract | undefined = hasContract ? { annualWage: Number(wage), start, end } : undefined;
    const cleanTargets: Player['focusTargets'] = {};
    focus.forEach((s) => (cleanTargets[s] = targets[s] ?? Math.min(10, Math.ceil(ratings[s]) + 1)));
    const pid = savePlayer({
      id: existing?.id,
      name: name.trim(),
      dob,
      position,
      altPosition: alt && alt !== position ? alt : undefined,
      shirt: shirt ? Number(shirt) : undefined,
      foot,
      status: existing?.status ?? 'fit',
      statusNote: existing?.statusNote,
      contract,
      ratings,
      focus,
      focusTargets: cleanTargets,
      guardian: guardian.trim() || undefined,
      notes: existing?.notes,
    });
    if (existing) router.back();
    else router.replace({ pathname: '/player/[id]', params: { id: pid } });
  };

  const e = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit player' : 'New player' }} />
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" error={e('name')} />
        <Row align="flex-start">
          <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="2008-04-21" error={e('dob')} autoCorrect={false} />
          <Field label="Shirt no." value={shirt} onChangeText={setShirt} keyboardType="number-pad" maxLength={2} error={e('shirt')} />
        </Row>
        <View style={{ gap: 6 }}>
          <Txt v="label">Position</Txt>
          <Segmented value={position} onChange={setPosition} options={POS_GROUPS.map((g) => ({ value: g, label: g }))} />
        </View>
        <View style={{ gap: 6 }}>
          <Txt v="label">Can also play</Txt>
          <Row gap={6} wrap>
            <Chip label="None" selected={!alt} onPress={() => setAlt(undefined)} />
            {POS_GROUPS.filter((g) => g !== position).map((g) => (
              <Chip key={g} label={g} selected={alt === g} color={t.pos[g]} onPress={() => setAlt(g)} />
            ))}
          </Row>
        </View>
        <View style={{ gap: 6 }}>
          <Txt v="label">Preferred foot</Txt>
          <Segmented value={foot} onChange={setFoot} options={[{ value: 'L', label: 'Left' }, { value: 'R', label: 'Right' }, { value: 'B', label: 'Both' }]} />
        </View>
        <Field label="Parent / guardian (optional)" value={guardian} onChangeText={setGuardian} autoCapitalize="words" />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h3">Contract</Txt>
          <Segmented value={hasContract ? 'yes' : 'no'} onChange={(v) => setHasContract(v === 'yes')} options={[{ value: 'yes', label: 'On contract' }, { value: 'no', label: 'None' }]} />
        </Row>
        {hasContract ? (
          <>
            <Field label={`Annual wage (${club?.currency ?? '£'})`} value={wage} onChangeText={setWage} keyboardType="decimal-pad" error={e('wage')} hint="Use 0 for unpaid but registered players." />
            <Row align="flex-start">
              <Field label="Starts" value={start} onChangeText={setStart} error={e('start')} autoCorrect={false} />
              <Field label="Ends" value={end} onChangeText={setEnd} error={e('end')} autoCorrect={false} />
            </Row>
          </>
        ) : null}
      </Card>

      {!existing ? (
        <Card>
          <Txt v="h3">Starting ratings (1–10)</Txt>
          <Txt v="small" dim>Your first assessment — later changes are logged as observations so progress can be tracked.</Txt>
          {SKILLS.filter((s) => s !== 'goalkeeping' || position === 'GK').map((s) => (
            <Stepper key={s} label={SKILL_LABEL[s]} value={ratings[s]} onChange={(v) => setRatings((r) => ({ ...r, [s]: v }))} />
          ))}
        </Card>
      ) : null}

      <Card>
        <Txt v="h3">Development focus (up to 3)</Txt>
        <Row gap={6} wrap>
          {SKILLS.filter((s) => s !== 'goalkeeping' || position === 'GK').map((s) => (
            <Chip key={s} label={SKILL_LABEL[s]} selected={focus.includes(s)} color={t.accent} onPress={() => toggleFocus(s)} />
          ))}
        </Row>
        {focus.map((s) => (
          <Stepper
            key={s}
            label={`Target: ${SKILL_LABEL[s]}`}
            value={targets[s] ?? Math.min(10, Math.ceil(ratings[s]) + 1)}
            step={1}
            onChange={(v) => setTargets((x) => ({ ...x, [s]: v }))}
            format={(n) => String(n)}
          />
        ))}
      </Card>

      <Row>
        <Btn label="Cancel" kind="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
        <Btn label="Save player" icon="checkmark" onPress={save} style={{ flex: 2 }} />
      </Row>
      {tried && !valid ? <Txt color={t.bad} v="small">Fix the highlighted fields to continue.</Txt> : null}
    </Screen>
  );
}
