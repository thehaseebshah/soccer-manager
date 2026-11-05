import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useClub } from '@/store/useClub';
import { Btn, Card, Chip, Field, Row, Screen, Segmented, Stepper, Txt, confirmAction } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { DEFAULT_CLUB, type Format } from '@/domain/types';
import { formationsFor } from '@/domain/lineup';
import { addDays, isValidDate, toISODate } from '@/domain/util';

export default function FixtureEdit() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useClub((s) => s.fixtures.find((f) => f.id === id));
  const club = useClub((s) => s.club) ?? DEFAULT_CLUB;
  const saveFixture = useClub((s) => s.saveFixture);
  const deleteFixture = useClub((s) => s.deleteFixture);

  const defaultDate = React.useMemo(() => `${toISODate(addDays(new Date(), 7))} 15:00`, []);
  const [opponent, setOpponent] = React.useState(existing?.opponent ?? '');
  const [dt, setDt] = React.useState(existing ? existing.date.replace('T', ' ') : defaultDate);
  const [home, setHome] = React.useState(existing?.home ?? true);
  const [format, setFormat] = React.useState<Format>(existing?.format ?? club.defaultFormat);
  const [formationId, setFormationId] = React.useState(existing?.formationId || formationsFor(existing?.format ?? club.defaultFormat)[0].id);
  const [mins, setMins] = React.useState(existing?.matchMinutes ?? club.matchMinutes);
  const [periods, setPeriods] = React.useState(existing?.periods ?? club.periods);
  const [venue, setVenue] = React.useState(existing?.venue ?? '');
  const [tried, setTried] = React.useState(false);

  const iso = dt.trim().replace(' ', 'T');
  const dateErr = !isValidDate(iso) || !iso.includes('T') ? 'Use YYYY-MM-DD HH:mm' : undefined;
  const oppErr = !opponent.trim() ? 'Opponent is required' : undefined;

  const pickFormat = (f: Format) => {
    setFormat(f);
    setFormationId(formationsFor(f)[0].id);
  };

  const save = () => {
    setTried(true);
    if (dateErr || oppErr) return;
    const planInvalid = existing && (existing.formationId !== formationId || existing.periods !== periods || existing.format !== format);
    const fid = saveFixture({
      id: existing?.id,
      opponent: opponent.trim(),
      date: iso,
      home,
      format,
      formationId,
      matchMinutes: mins,
      periods,
      venue: venue.trim() || undefined,
      ...(planInvalid ? { plan: undefined } : {}),
    });
    if (existing) router.back();
    else router.replace({ pathname: '/fixture/[id]', params: { id: fid } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit fixture' : 'New fixture' }} />
      <Card>
        <Field label="Opponent" value={opponent} onChangeText={setOpponent} autoCapitalize="words" error={tried ? oppErr : undefined} />
        <Field label="Kick-off" value={dt} onChangeText={setDt} placeholder="2026-11-14 15:00" error={tried ? dateErr : undefined} autoCorrect={false} />
        <Segmented value={home ? 'h' : 'a'} onChange={(v) => setHome(v === 'h')} options={[{ value: 'h', label: 'Home' }, { value: 'a', label: 'Away' }]} />
        <Field label="Venue (optional)" value={venue} onChangeText={setVenue} />
      </Card>
      <Card>
        <Txt v="label">Format</Txt>
        <Segmented<Format> value={format} onChange={pickFormat} options={[{ value: 7, label: '7-a-side' }, { value: 9, label: '9-a-side' }, { value: 11, label: '11-a-side' }]} />
        <Txt v="label">Formation</Txt>
        <Row gap={6} wrap>
          {formationsFor(format).map((f) => (
            <Chip key={f.id} label={f.name} selected={formationId === f.id} onPress={() => setFormationId(f.id)} />
          ))}
        </Row>
        <Stepper label="Match length (min)" value={mins} onChange={setMins} min={20} max={120} step={5} format={(n) => String(n)} />
        <Stepper label="Rotation windows" value={periods} onChange={setPeriods} min={2} max={9} step={1} format={(n) => String(n)} />
        <Txt v="small" dim>
          Each window lasts {Math.round((mins / periods) * 10) / 10} minutes. More windows means finer-grained fairness, but more substitutions.
        </Txt>
      </Card>
      <Row>
        <Btn label="Cancel" kind="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
        <Btn label="Save fixture" icon="checkmark" onPress={save} style={{ flex: 2 }} />
      </Row>
      {existing ? (
        <Btn
          label="Delete fixture"
          kind="danger"
          icon="trash"
          onPress={() =>
            confirmAction('Delete fixture?', 'Minutes from this match will be removed from season totals.', () => {
              deleteFixture(existing.id);
              router.dismissAll();
            })
          }
        />
      ) : null}
      <View style={{ height: 1, backgroundColor: t.bg }} />
    </Screen>
  );
}
