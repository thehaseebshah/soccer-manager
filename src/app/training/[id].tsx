import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useClub } from '@/store/useClub';
import { Avatar, Btn, Card, Chip, Empty, Field, Row, Screen, Txt, confirmAction } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { SKILLS } from '@/domain/types';
import { SKILL_LABEL } from '@/domain/ratings';
import { formatDate, isValidDate } from '@/domain/util';

export default function TrainingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useClub((s) => s.trainings.find((x) => x.id === id));
  const players = useClub((s) => s.players);
  const saveTraining = useClub((s) => s.saveTraining);
  const setAttendance = useClub((s) => s.setAttendance);
  const deleteTraining = useClub((s) => s.deleteTraining);
  const [date, setDate] = React.useState(session?.date ?? '');

  if (!session) {
    return (
      <Screen>
        <Empty icon="clipboard-outline" title="Session not found" />
      </Screen>
    );
  }
  const present = players.filter((p) => session.attendance[p.id]).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Training · ${formatDate(session.date)}` }} />
      <Card>
        <Field
          label="Date"
          value={date}
          onChangeText={(v) => {
            setDate(v);
            if (isValidDate(v)) saveTraining({ id: session.id, date: v });
          }}
          error={isValidDate(date) ? undefined : 'Use YYYY-MM-DD'}
        />
        <Txt v="label">Focus</Txt>
        <Row gap={6} wrap>
          <Chip label="None" selected={!session.focus} onPress={() => saveTraining({ id: session.id, date: session.date, focus: undefined })} />
          {SKILLS.filter((s) => s !== 'goalkeeping').map((s) => (
            <Chip key={s} label={SKILL_LABEL[s]} selected={session.focus === s} color={t.accent} onPress={() => saveTraining({ id: session.id, date: session.date, focus: s })} />
          ))}
        </Row>
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3">Attendance · {present}/{players.length}</Txt>
        <Btn label="Everyone" small kind="ghost" onPress={() => players.forEach((p) => setAttendance(session.id, p.id, true))} />
      </Row>
      <Card>
        {players.map((p) => {
          const here = !!session.attendance[p.id];
          return (
            <Row key={p.id} style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Avatar name={p.name} size={28} color={t.pos[p.position]} />
                <Txt numberOfLines={1} style={{ fontWeight: '600', flex: 1 }}>{p.name}</Txt>
              </Row>
              <Row gap={4}>
                <Chip label="Present" selected={here && p.id in session.attendance} color={t.good} onPress={() => setAttendance(session.id, p.id, true)} />
                <Chip label="Absent" selected={!here && p.id in session.attendance} color={t.bad} onPress={() => setAttendance(session.id, p.id, false)} />
              </Row>
            </Row>
          );
        })}
      </Card>
      <View style={{ height: 4 }} />
      <Btn
        label="Delete session"
        kind="danger"
        icon="trash"
        onPress={() =>
          confirmAction('Delete session?', 'Attendance for this session will be removed.', () => {
            deleteTraining(session.id);
            router.back();
          })
        }
      />
    </Screen>
  );
}
