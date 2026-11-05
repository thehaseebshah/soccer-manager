import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useClub } from '@/store/useClub';
import { Btn, Card, Empty, Field, Row, Screen, Segmented, Stepper, Txt } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { SKILLS, type Observation } from '@/domain/types';
import { SKILL_LABEL, overallOfRatings } from '@/domain/ratings';

export default function Observe() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = useClub((s) => s.players.find((p) => p.id === id));
  const addObservation = useClub((s) => s.addObservation);
  const [ratings, setRatings] = React.useState(player?.ratings);
  const [note, setNote] = React.useState('');
  const [kind, setKind] = React.useState<Observation['kind']>('training');

  if (!player || !ratings) {
    return (
      <Screen>
        <Empty icon="person-remove" title="Player not found" />
      </Screen>
    );
  }
  const before = overallOfRatings(player.ratings, player.position);
  const after = overallOfRatings(ratings, player.position);

  return (
    <Screen>
      <Stack.Screen options={{ title: `Observe ${player.name.split(' ')[0]}` }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h3">Overall</Txt>
          <Txt v="h2" color={after > before ? t.good : after < before ? t.bad : t.text}>
            {before} → {after}
          </Txt>
        </Row>
        <Segmented<Observation['kind']>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'training', label: 'Training' },
            { value: 'match', label: 'Match' },
            { value: 'assessment', label: 'Assessment' },
          ]}
        />
      </Card>
      <Card>
        {SKILLS.filter((s) => s !== 'goalkeeping' || player.position === 'GK').map((s) => (
          <Stepper key={s} label={SKILL_LABEL[s]} value={ratings[s]} onChange={(v) => setRatings((r) => ({ ...r!, [s]: v }))} />
        ))}
      </Card>
      <Field label="Coach’s note" value={note} onChangeText={setNote} multiline placeholder="What did you see? What should they work on?" />
      <Btn
        label="Save observation"
        icon="checkmark"
        onPress={() => {
          addObservation({ playerId: player.id, ratings, note: note.trim(), kind });
          router.back();
        }}
      />
    </Screen>
  );
}
