import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { Btn, Card, Empty, Pill, Row, Screen, SectionTitle, Txt } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { formatDate, toISODate } from '@/domain/util';
import { useClub } from '@/store/useClub';

export default function Matchday() {
  const t = useTheme();
  const router = useRouter();
  const { upcoming, played, trainings, players, club } = useDerived();
  const saveTraining = useClub((s) => s.saveTraining);
  const sessions = [...trainings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const addTraining = () => {
    const id = saveTraining({ date: toISODate(new Date()), attendance: Object.fromEntries(players.filter((p) => p.status === 'fit').map((p) => [p.id, true])) });
    router.push({ pathname: '/training/[id]', params: { id } });
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h2">Fixtures</Txt>
        <Btn label="Add fixture" icon="add" small onPress={() => router.push('/fixture/edit')} />
      </Row>

      {upcoming.length === 0 && played.length === 0 ? (
        <Empty icon="calendar-outline" title="No fixtures yet" body="Add a fixture to collect availability and generate a fair rotation plan." />
      ) : null}

      {upcoming.map((f) => {
        const a = Object.values(f.availability);
        const yes = a.filter((x) => x === 'yes').length;
        return (
          <Card key={f.id} onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: f.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="h3">
                {f.home ? 'vs' : '@'} {f.opponent}
              </Txt>
              {f.status === 'live' ? <Pill label="LIVE" color={t.bad} solid icon="radio" /> : f.plan ? <Pill label="Plan ready" color={t.good} icon="checkmark" /> : <Pill label="Needs plan" color={t.warn} />}
            </Row>
            <Txt v="small" dim>
              {formatDate(f.date, true)} · {f.format}-a-side · {f.matchMinutes} min
            </Txt>
            <Txt v="small" dim>
              {yes} confirmed · {players.length - a.length} unanswered
            </Txt>
          </Card>
        );
      })}

      {played.length > 0 ? <SectionTitle>Results</SectionTitle> : null}
      {played.map((f) => {
        const r = f.result;
        const tone = r ? (r.for > r.against ? t.good : r.for < r.against ? t.bad : t.warn) : t.textDim;
        return (
          <Card key={f.id} onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: f.id } })} style={{ paddingVertical: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt v="h3" numberOfLines={1}>
                  {f.home ? 'vs' : '@'} {f.opponent}
                </Txt>
                <Txt v="small" dim>{formatDate(f.date)}</Txt>
              </View>
              {r ? <Txt v="num" color={tone} style={{ fontSize: 22 }}>{r.for}–{r.against}</Txt> : null}
            </Row>
          </Card>
        );
      })}

      <SectionTitle action={<Btn label="Log session" icon="add" small kind="secondary" onPress={addTraining} />}>Training</SectionTitle>
      {sessions.length === 0 ? (
        <Txt v="small" dim>No training sessions logged. Attendance feeds each player’s profile.</Txt>
      ) : (
        sessions.map((s) => {
          const present = Object.values(s.attendance).filter(Boolean).length;
          return (
            <Card key={s.id} onPress={() => router.push({ pathname: '/training/[id]', params: { id: s.id } })} style={{ paddingVertical: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Txt v="h3">{formatDate(s.date)}</Txt>
                  <Txt v="small" dim>{s.focus ? `Focus: ${s.focus}` : 'No focus set'}</Txt>
                </View>
                <Pill label={`${present}/${Object.keys(s.attendance).length || club.defaultFormat} present`} color={t.primary} />
              </Row>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
