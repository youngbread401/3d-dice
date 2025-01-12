import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  SafeAreaView,
  Vibration,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { DiceRoller } from './components/DiceModel';

// Get window dimensions
const windowDimensions = Dimensions.get('window');
const isSmallScreen = windowDimensions.width < 768;

// Constants
const DICE_TYPES = [
  { sides: 4, color: '#FF6B6B' },
  { sides: 6, color: '#4ECDC4' },
  { sides: 8, color: '#45B7D1' },
  { sides: 10, color: '#96CEB4' },
  { sides: 12, color: '#FFEEAD' },
  { sides: 20, color: '#D4A5A5' },
  { sides: 100, color: '#9B59B6' }
];

// Theme configuration
const THEME = {
  primary: '#1E1E1E',
  secondary: '#2D2D2D',
  accent: '#7289DA',
  text: {
    light: '#FFFFFF'
  },
  background: {
    primary: '#1E1E1E',
    panel: '#363636'
  }
};

export default function App() {
  const [diceHistory, setDiceHistory] = useState([]);
  const [rollType, setRollType] = useState('normal');
  const [modifier, setModifier] = useState(0);
  const [diceQuantity, setDiceQuantity] = useState(1);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ScrollView>
          <View style={styles.mainArea}>
            <View style={styles.diceSection}>
              <View style={diceStyles.diceControls}>
                <View style={diceStyles.controlsRow}>
                  <View style={diceStyles.controlGroup}>
                    <TouchableOpacity
                      style={[
                        diceStyles.controlButton,
                        rollType === 'advantage' && diceStyles.controlActive,
                        rollType === 'advantage' && { backgroundColor: THEME.success }
                      ]}
                      onPress={() => setRollType(current => 
                        current === 'advantage' ? 'normal' : 'advantage'
                      )}
                    >
                      <Text style={styles.buttonText}>Advantage</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        diceStyles.controlButton,
                        rollType === 'disadvantage' && diceStyles.controlActive,
                        rollType === 'disadvantage' && { backgroundColor: THEME.danger }
                      ]}
                      onPress={() => setRollType(current => 
                        current === 'disadvantage' ? 'normal' : 'disadvantage'
                      )}
                    >
                      <Text style={styles.buttonText}>Disadvantage</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={diceStyles.diceGrid}>
                {DICE_TYPES.map(({ sides, color }) => (
                  <View key={sides} style={diceStyles.diceContainer}>
                    <DiceRoller
                      sides={sides}
                      color={color}
                      quantity={diceQuantity}
                      onRoll={(newResults) => {
                        const rolls = newResults;
                        
                        const finalRolls = rolls.map(roll => {
                          if (rollType !== 'normal') {
                            const secondRoll = Math.floor(Math.random() * sides) + 1;
                            return rollType === 'advantage'
                              ? Math.max(roll, secondRoll)
                              : Math.min(roll, secondRoll);
                          }
                          return roll;
                        });

                        const total = finalRolls.reduce((sum, roll) => sum + roll, 0) + modifier;

                        const newResult = {
                          dice: `${diceQuantity}d${sides}`,
                          rolls: rolls,
                          individualTotals: finalRolls,
                          modifier,
                          rollType,
                          total: total,
                          timestamp: Date.now()
                        };
                        
                        setDiceHistory(prev => [newResult, ...prev.slice(0, 49)]);
                        Vibration.vibrate(50);
                      }}
                    />
                    <Text style={diceStyles.diceButtonText}>d{sides}</Text>
                  </View>
                ))}
              </View>

              <View style={diceStyles.historyContainer}>
                <ScrollView style={diceStyles.historyScroll}>
                  {diceHistory.map((result) => (
                    <View 
                      key={result.timestamp}
                      style={diceStyles.historyItem}
                    >
                      <View style={diceStyles.historyLeft}>
                        <View style={diceStyles.historyInfo}>
                          <Text style={diceStyles.historyDice}>
                            {result.dice}
                            {result.modifier ? ` + ${result.modifier}` : ''}
                            {result.rollType === 'advantage' ? ' (Adv)' : 
                             result.rollType === 'disadvantage' ? ' (Dis)' : ''}
                          </Text>
                        </View>
                        {result.rolls.length > 1 && (
                          <Text style={diceStyles.historyRolls}>
                            Rolls: {result.rolls.join(', ')}
                          </Text>
                        )}
                      </View>
                      <Text style={diceStyles.historyTotal}>
                        {result.total}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background.primary,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  mainArea: {
    flex: 1,
    flexDirection: isSmallScreen ? 'column' : 'row',
    padding: isSmallScreen ? 10 : 20,
    gap: 20,
  },
  buttonText: {
    color: THEME.text.light,
    fontSize: 16,
  }
});

const diceStyles = StyleSheet.create({
  diceSection: {
    flex: 1,
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: 15,
  },
  diceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'center',
    padding: 10,
  },
  diceContainer: {
    alignItems: 'center',
  },
  diceButtonText: {
    color: THEME.text.light,
    marginTop: 5,
    fontSize: 14,
  },
  historyContainer: {
    marginTop: 20,
    flex: 1,
  },
  historyScroll: {
    maxHeight: 300,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.secondary,
  },
  historyLeft: {
    flex: 1,
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDice: {
    color: THEME.text.light,
    fontSize: 16,
  },
  historyRolls: {
    color: THEME.text.light,
    opacity: 0.7,
    fontSize: 14,
    marginTop: 4,
  },
  historyTotal: {
    color: THEME.text.light,
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  controlGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: THEME.secondary,
  },
  controlActive: {
    backgroundColor: THEME.accent,
  }
});