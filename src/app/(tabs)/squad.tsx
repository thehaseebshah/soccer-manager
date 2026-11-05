import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDerived } from '@/store/derived';
import { Avatar, Btn, Card, Chip, Empty, Field, Pill, Row, Screen, Txt } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { POS_GROUPS, type PosGroup } from '@/domain/types';
import { overall } from '@/domain/ratings';
import { ageOn } from '@/domain/util';
import { contractFlag } from '@/domain/budget';

type Sort = 'pos' | 'ovr' | 'minutes' | 'age';

export default function Squad() {
  const t = useTheme();
  const router = useRouter();
  const { players, statById } = useDerived();
  const [q, setQ] = React.useState('');
  const [pos, setPos] = React.useState<PosGroup | 'ALL'>('ALL');
  const [sort, setSort] = React.useState<Sort>('pos');
  const now = React.useMemo(() => new Date(), []);

  const list = players
    .filter((p) => (pos === 'ALL' || p.position === pos) && p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === 'ovr') return overall(b) - overall(a);
      if (sort === 'minutes') return (statById[b.id]?.minutes ?? 0) - (statById[a.id]?.minutes ?? 0);
      if (sort === 'age') return ageOn(a.dob, now) - ageOn(b.dob, now);
      return POS_GROUPS.indexOf(a.position) - POS_GROUPS.indexOf(b.position) || overall(b) - overall(a);
    });

  return (
    <Screen>
      <Row style={{ alignItems: 'flex-end' }}>
        <Field label="Search" value={q} onChangeText={setQ} placeholder="Find a player" />
        <Btn label="Add" icon="person-add" onPress={() => router.push('/player/edit')} />
      </Row>
      <Row gap={6} wrap>
        <Chip label="All" selected={pos === 'ALL'} onPress={() => setPos('ALL')} />
        {POS_GROUPS.map((g) => (
          <Chip key={g} label={g} selected={pos === g} color={t.pos[g]} onPress={() => setPos(g)} />
        ))}
      </Row>
      <Row gap={6} wrap>
        <Txt v="label">Sort</Txt>
        {(['pos', 'ovr', 'minutes', 'age'] as Sort[]).map((s) => (
          <Chip key={s} label={s === 'pos' ? 'Position' : s === 'ovr' ? 'Rating' : s === 'minutes' ? 'Minutes' : 'Age'} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </Row>

      {players.length === 0 ? (
        <Empty icon="people-outline" title="No players yet" body="Add your squad to start planning." />
      ) : list.length === 0 ? (
        <Empty icon="search" title="No matches" />
      ) : (
        list.map((p) => {
          const st = statById[p.id];
          const cf = contractFlag(p, now);
          return (
            <Card key={p.id} onPress={() => router.push({ pathname: '/player/[id]', params: { id: p.id } })} style={{ paddingVertical: 12 }}>
              <Row>
                <Avatar name={p.name} color={t.pos[p.position]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="h3" numberOfLines={1}>
                    {p.shirt ? `${p.shirt}. ` : ''}
                    {p.name}
                  </Txt>
                  <Row gap={6} wrap>
                    <Pill label={p.position} color={t.pos[p.position]} />
                    <Txt v="small" dim>
                      {ageOn(p.dob, now)}y · {st ? `${Math.round(st.minutes)}′ · ${st.apps} apps` : 'no matches'}
                    </Txt>
                    {p.status !== 'fit' ? <Pill label={p.status === 'injured' ? 'Injured' : 'Unavailable'} color={t.bad} icon="medkit" /> : null}
                    {cf.flag === 'critical' || cf.flag === 'expired' ? <Pill label={cf.flag === 'expired' ? 'Contract expired' : 'Contract ending'} color={t.warn} icon="document-text" /> : null}
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt v="num" style={{ fontSize: 22 }}>{overall(p)}</Txt>
                  <Txt v="label">OVR</Txt>
                </View>
              </Row>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
