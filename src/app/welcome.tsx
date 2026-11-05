import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClub } from '@/store/useClub';
import { Btn, Card, Field, Row, Screen, Segmented, Txt } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { DEFAULT_CLUB, type Club } from '@/domain/types';

const PRESETS: Record<Club['level'], Partial<Club>> = {
  youth: { defaultFormat: 9, matchMinutes: 60, periods: 4, minMinutesPct: 50, balance: 0.15, annualWageBudget: 0 },
  amateur: { defaultFormat: 11, matchMinutes: 90, periods: 6, minMinutesPct: 30, balance: 0.5, annualWageBudget: 60000 },
  'semi-pro': { defaultFormat: 11, matchMinutes: 90, periods: 6, minMinutesPct: 20, balance: 0.7, annualWageBudget: 250000 },
};

export default function Welcome() {
  const t = useTheme();
  const createClub = useClub((s) => s.createClub);
  const loadDemo = useClub((s) => s.loadDemo);
  const [name, setName] = React.useState('');
  const [currency, setCurrency] = React.useState('£');
  const [level, setLevel] = React.useState<Club['level']>('amateur');

  return (
    <Screen>
      <View style={{ paddingTop: 36, gap: 10 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="football" size={32} color={t.primaryText} />
        </View>
        <Txt v="title">Gaffer</Txt>
        <Txt dim>
          The club manager that connects the owner’s books to the coach’s lineup — fair rotations, wage budgets, contracts and player development in one place.
        </Txt>
      </View>

      <Card>
        <Txt v="h2">Set up your club</Txt>
        <Field label="Club name" value={name} onChangeText={setName} placeholder="e.g. Northgate United" autoCapitalize="words" />
        <Row>
          <Field label="Currency" value={currency} onChangeText={setCurrency} maxLength={3} />
          <View style={{ flex: 3 }} />
        </Row>
        <View style={{ gap: 6 }}>
          <Txt v="label">Level (sets sensible defaults)</Txt>
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: 'youth', label: 'Youth' },
              { value: 'amateur', label: 'Amateur' },
              { value: 'semi-pro', label: 'Semi-pro' },
            ]}
          />
          <Txt v="small" dim>
            {level === 'youth'
              ? '9-a-side, 60 min, every player gets at least half the game.'
              : level === 'amateur'
                ? '11-a-side, 90 min, every player gets at least 30% of the game.'
                : '11-a-side, 90 min, wage budget & contract tools front and centre.'}
          </Txt>
        </View>
        <Btn
          label="Create club"
          icon="checkmark-circle"
          disabled={!name.trim()}
          onPress={() => createClub({ ...DEFAULT_CLUB, ...PRESETS[level], level, name: name.trim(), currency: currency.trim() || '£' })}
        />
      </Card>

      <Card>
        <Txt v="h3">Just exploring?</Txt>
        <Txt v="small" dim>Load a demo semi-pro club with 19 players, a season of results, contracts and development history.</Txt>
        <Btn label="Load demo club" kind="secondary" icon="sparkles" onPress={loadDemo} />
      </Card>
    </Screen>
  );
}
