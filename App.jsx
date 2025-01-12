import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Pressable,
  TextInput, 
  ScrollView, 
  Alert, 
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Keyboard,
  Vibration,
  Dimensions
} from 'react-native';
import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  get, 
  off 
} from 'firebase/database';
import { debounce } from 'lodash';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { DiceRoller } from './components/DiceModel';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSy8ia6vKnq95_gbO7lnohVbyAQzqBtk4",
  authDomain: "dndcombattracker-572b0.firebaseapp.com",
  databaseURL: "https://dndcombattracker-572b0-default-rtdb.firebaseio.com",
  projectId: "dndcombattracker-572b0",
  storageBucket: "dndcombattracker-572b0.firebasestorage.app",
  messagingSenderId: "812186225431",
  appId: "1:812186225431:web:8da48e238d10db01d14552"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

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
  success: '#3BA55C',
  danger: '#ED4245',
  text: {
    light: '#FFFFFF'
  },
  background: {
    primary: '#1E1E1E',
    panel: '#363636'
  }
};

// Constants
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ffffff'];
const GRID_SIZE = 10;
const ABILITY_SCORES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SKILLS = {
  STR: ['Athletics'],
  DEX: ['Acrobatics', 'Sleight of Hand', 'Stealth'],
  CON: [],
  INT: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
  WIS: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
  CHA: ['Deception', 'Intimidation', 'Performance', 'Persuasion']
};
const CURRENCY = ['CP', 'SP', 'EP', 'GP', 'PP'];
const STATUS_EFFECTS = [
  { id: 'blinded', name: 'Blinded', icon: '👁️' },
  { id: 'charmed', name: 'Charmed', icon: '💕' },
  { id: 'deafened', name: 'Deafened', icon: '👂' },
  { id: 'frightened', name: 'Frightened', icon: '😨' },
  { id: 'grappled', name: 'Grappled', icon: '🤼' },
  { id: 'incapacitated', name: 'Incapacitated', icon: '💫' },
  { id: 'invisible', name: 'Invisible', icon: '👻' },
  { id: 'paralyzed', name: 'Paralyzed', icon: '⚡' },
  { id: 'petrified', name: 'Petrified', icon: '🗿' },
  { id: 'poisoned', name: 'Poisoned', icon: '🤢' },
  { id: 'prone', name: 'Prone', icon: '⬇️' },
  { id: 'restrained', name: 'Restrained', icon: '⛓️' },
  { id: 'stunned', name: 'Stunned', icon: '💫' },
  { id: 'unconscious', name: 'Unconscious', icon: '💤' }
];

// Initial game state
const initialGameState = {
  tokens: {},
  layers: {
    grid: true,
    terrain: {},
    tokens: {},
    effects: {},
    fog: {}
  },
  initiative: [],
  inCombat: false,
  currentTurn: 0,
  settings: {
    gridSize: GRID_SIZE,
    showCoordinates: true,
  },
  partyLoot: {
    currency: { CP: 0, SP: 0, EP: 0, GP: 0, PP: 0 },
    items: [],
    currentViewer: null
  },
  characters: [],
  lastUpdate: Date.now()
};

export default function App() {
  // Firebase refs
  const firebaseRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Room state
  const [roomCode, setRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Game state
  const [tokens, setTokens] = useState({});
  const [layers, setLayers] = useState(initialGameState.layers);
  const [initiative, setInitiative] = useState([]);
  const [inCombat, setInCombat] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // UI state
  const [selectedToken, setSelectedToken] = useState(null);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTokenEditor, setShowTokenEditor] = useState(false);
  const [showEffectsPicker, setShowEffectsPicker] = useState(false);
  const [showLootManager, setShowLootManager] = useState(false);
  const [partyLoot, setPartyLoot] = useState(initialGameState.partyLoot);

  // Dice roller state
  const [diceHistory, setDiceHistory] = useState([]);
  const [rollType, setRollType] = useState('normal');
  const [modifier, setModifier] = useState(0);
  const [diceQuantity, setDiceQuantity] = useState(1);

  // Token being edited
  const [editingToken, setEditingToken] = useState(null);
  const [editingTokenPosition, setEditingTokenPosition] = useState(null);

  // Firebase and room management functions
  const connectToRoom = useCallback(async (code) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const roomRef = ref(database, `rooms/${code}`);
      const snapshot = await get(roomRef);
      
      if (!snapshot.exists()) {
        await set(roomRef, initialGameState);
      }
      
      firebaseRef.current = roomRef;
      setRoomCode(code);
      
      // Subscribe to room updates
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setTokens(data.tokens || {});
          setLayers(data.layers || initialGameState.layers);
          setInitiative(data.initiative || []);
          setInCombat(data.inCombat || false);
          setCurrentTurn(data.currentTurn || 0);
          setPartyLoot(data.partyLoot || initialGameState.partyLoot);
        }
      });
      
      unsubscribeRef.current = unsubscribe;
      setIsConnected(true);
      
    } catch (err) {
      console.error('Error connecting to room:', err);
      setError('Failed to connect to room');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveGameState = useCallback(async () => {
    if (!firebaseRef.current) return;
    
    try {
      await set(firebaseRef.current, {
        tokens,
        layers,
        initiative,
        inCombat,
        currentTurn,
        partyLoot,
        lastUpdate: Date.now()
      });
    } catch (err) {
      console.error('Error saving game state:', err);
      Alert.alert('Error', 'Failed to save game state');
    }
  }, [tokens, layers, initiative, inCombat, currentTurn, partyLoot]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Grid and token management
  const handleCellPress = useCallback(async (row, col) => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
      const position = `${row}-${col}`;
      const newTokens = { ...tokens };
      
      if (tokens[position]) {
        delete newTokens[position];
      } else {
        newTokens[position] = {
          name: `Token ${Object.keys(tokens).length + 1}`,
          color: currentColor,
          hp: 10,
          maxHp: 10,
          initiativeBonus: 0,
          effects: [],
          position
        };
      }

      setTokens(newTokens);
      await saveGameState();
    } catch (error) {
      console.error('Error updating tokens:', error);
      Alert.alert('Error', 'Failed to update token');
    } finally {
      setIsUpdating(false);
    }
  }, [tokens, currentColor, layers, initiative, inCombat, currentTurn, isUpdating]);

  const handleTokenPress = useCallback((position) => {
    const token = tokens[position];
    if (!token) return;
    
    setEditingToken(token);
    setEditingTokenPosition(position);
    setShowTokenEditor(true);
  }, [tokens]);

  const updateToken = useCallback(async (position, updates) => {
    try {
      const newTokens = { ...tokens };
      newTokens[position] = {
        ...newTokens[position],
        ...updates
      };
      
      setTokens(newTokens);
      await saveGameState();
    } catch (error) {
      console.error('Error updating token:', error);
      Alert.alert('Error', 'Failed to update token');
    }
  }, [tokens, saveGameState]);

  const deleteToken = useCallback(async (position) => {
    try {
      const newTokens = { ...tokens };
      delete newTokens[position];
      
      setTokens(newTokens);
      setShowTokenEditor(false);
      await saveGameState();
    } catch (error) {
      console.error('Error deleting token:', error);
      Alert.alert('Error', 'Failed to delete token');
    }
  }, [tokens, saveGameState]);

  // Initiative tracker functions
  const startCombat = useCallback(async () => {
    try {
      const tokenArray = Object.entries(tokens).map(([position, token]) => ({
        ...token,
        position,
        initiative: Math.floor(Math.random() * 20) + 1 + (token.initiativeBonus || 0)
      }));
      
      const sortedInitiative = tokenArray
        .sort((a, b) => b.initiative - a.initiative)
        .map(token => ({
          position: token.position,
          details: `${token.name} (${token.initiative})`
        }));
      
      setInitiative(sortedInitiative);
      setInCombat(true);
      setCurrentTurn(0);
      await saveGameState();
    } catch (error) {
      console.error('Error starting combat:', error);
      Alert.alert('Error', 'Failed to start combat');
    }
  }, [tokens, saveGameState]);

  const endCombat = useCallback(async () => {
    try {
      setInitiative([]);
      setInCombat(false);
      setCurrentTurn(0);
      await saveGameState();
    } catch (error) {
      console.error('Error ending combat:', error);
      Alert.alert('Error', 'Failed to end combat');
    }
  }, [saveGameState]);

  const nextTurn = useCallback(async () => {
    try {
      const nextTurn = (currentTurn + 1) % initiative.length;
      setCurrentTurn(nextTurn);
      await saveGameState();
    } catch (error) {
      console.error('Error advancing turn:', error);
      Alert.alert('Error', 'Failed to advance turn');
    }
  }, [currentTurn, initiative.length, saveGameState]);

  const previousTurn = useCallback(async () => {
    try {
      const prevTurn = currentTurn > 0 ? currentTurn - 1 : initiative.length - 1;
      setCurrentTurn(prevTurn);
      await saveGameState();
    } catch (error) {
      console.error('Error rewinding turn:', error);
      Alert.alert('Error', 'Failed to rewind turn');
    }
  }, [currentTurn, initiative.length, saveGameState]);

  // Party loot management
  const updatePartyLoot = useCallback(async (updates) => {
    try {
      const newPartyLoot = {
        ...partyLoot,
        ...updates
      };
      
      setPartyLoot(newPartyLoot);
      await saveGameState();
    } catch (error) {
      console.error('Error updating party loot:', error);
      Alert.alert('Error', 'Failed to update party loot');
    }
  }, [partyLoot, saveGameState]);

  const addLootItem = useCallback(async (item) => {
    try {
      const newPartyLoot = {
        ...partyLoot,
        items: [...partyLoot.items, {
          ...item,
          id: Date.now().toString()
        }]
      };
      
      setPartyLoot(newPartyLoot);
      await saveGameState();
    } catch (error) {
      console.error('Error adding loot item:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  }, [partyLoot, saveGameState]);

  const removeLootItem = useCallback(async (itemId) => {
    try {
      const newPartyLoot = {
        ...partyLoot,
        items: partyLoot.items.filter(item => item.id !== itemId)
      };
      
      setPartyLoot(newPartyLoot);
      await saveGameState();
    } catch (error) {
      console.error('Error removing loot item:', error);
      Alert.alert('Error', 'Failed to remove item');
    }
  }, [partyLoot, saveGameState]);

  const updateCurrency = useCallback(async (type, amount) => {
    try {
      const newPartyLoot = {
        ...partyLoot,
        currency: {
          ...partyLoot.currency,
          [type]: Math.max(0, (partyLoot.currency[type] || 0) + amount)
        }
      };
      
      setPartyLoot(newPartyLoot);
      await saveGameState();
    } catch (error) {
      console.error('Error updating currency:', error);
      Alert.alert('Error', 'Failed to update currency');
    }
  }, [partyLoot, saveGameState]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {!isConnected ? (
          <View style={styles.connectContainer}>
            <Text style={styles.title}>D&D Combat Tracker</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter room code..."
              placeholderTextColor="#666"
              value={roomCode}
              onChangeText={setRoomCode}
            />
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => connectToRoom(roomCode)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Connect</Text>
              )}
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Room: {roomCode}</Text>
              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.controlButton, inCombat && styles.activeButton]}
                  onPress={inCombat ? endCombat : startCombat}
                >
                  <Text style={styles.buttonText}>
                    {inCombat ? 'End Combat' : 'Start Combat'}
                  </Text>
                </TouchableOpacity>
                {inCombat && (
                  <>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={previousTurn}
                    >
                      <Text style={styles.buttonText}>Previous</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={nextTurn}
                    >
                      <Text style={styles.buttonText}>Next</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => setShowLootManager(true)}
                >
                  <Text style={styles.buttonText}>Party Loot</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Main content area */}
            <ScrollView>
              <View style={styles.mainArea}>
                {/* Grid section */}
                <View style={styles.gridSection}>
                  <View style={styles.gridContainer}>
                    {/* Column headers */}
                    <View style={styles.gridRow}>
                      <View style={styles.gridCell} />
                      {Array.from({ length: GRID_SIZE }, (_, i) => (
                        <View key={i} style={styles.gridHeader}>
                          <Text style={styles.gridHeaderText}>{i + 1}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Grid rows */}
                    {Array.from({ length: GRID_SIZE }, (_, row) => (
                      <View key={row} style={styles.gridRow}>
                        {/* Row header */}
                        <View style={styles.gridHeader}>
                          <Text style={styles.gridHeaderText}>{LETTERS[row]}</Text>
                        </View>

                        {/* Grid cells */}
                        {Array.from({ length: GRID_SIZE }, (_, col) => {
                          const position = `${row}-${col}`;
                          const token = tokens[position];
                          
                          return (
                            <Pressable
                              key={col}
                              style={[
                                styles.gridCell,
                                token && { backgroundColor: token.color }
                              ]}
                              onPress={() => handleCellPress(row, col)}
                              onLongPress={() => token && handleTokenPress(position)}
                            >
                              {token && (
                                <Text style={styles.tokenText}>
                                  {token.name}
                                </Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>

                  {/* Color picker */}
                  <View style={styles.colorPicker}>
                    {COLORS.map(color => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorButton,
                          { backgroundColor: color },
                          currentColor === color && styles.selectedColor
                        ]}
                        onPress={() => setCurrentColor(color)}
                      />
                    ))}
                  </View>
                </View>

                {/* Dice Roller Section */}
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
                      <View style={diceStyles.modifierGroup}>
                        <Text style={diceStyles.modifierLabel}>Modifier</Text>
                        <TextInput
                          style={diceStyles.modifierInput}
                          value={String(modifier)}
                          onChangeText={text => {
                            const num = parseInt(text) || 0;
                            setModifier(num);
                          }}
                          keyboardType="numeric"
                          selectTextOnFocus={true}
                        />
                      </View>
                    </View>
                    
                    <View style={diceStyles.controlsRow}>
                      <View style={diceStyles.quantityGroup}>
                        <Text style={diceStyles.quantityLabel}>Quantity</Text>
                        <TextInput
                          style={diceStyles.quantityInput}
                          value={String(diceQuantity)}
                          onChangeText={text => {
                            const num = parseInt(text) || 1;
                            setDiceQuantity(Math.max(1, Math.min(num, 100)));
                          }}
                          keyboardType="numeric"
                          selectTextOnFocus={true}
                        />
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

                {/* Initiative Tracker Section */}
                <View style={styles.initiativeSection}>
                  <Text style={styles.sectionTitle}>Initiative Order</Text>
                  
                  {inCombat ? (
                    <ScrollView style={styles.initiativeList}>
                      {initiative.map((item, index) => {
                        const token = tokens[item.position];
                        const isCurrentTurn = index === currentTurn;
                        
                        return (
                          <View 
                            key={item.position}
                            style={[
                              styles.initiativeItem,
                              isCurrentTurn && styles.currentTurn
                            ]}
                          >
                            <View style={styles.initiativeLeft}>
                              <Text style={styles.initiativeName}>
                                {token?.name || 'Unknown'}
                              </Text>
                              <Text style={styles.initiativeDetails}>
                                {item.details}
                              </Text>
                            </View>
                            {token?.effects?.length > 0 && (
                              <View style={styles.effectsRow}>
                                {token.effects.map(effectId => {
                                  const effect = STATUS_EFFECTS.find(e => e.id === effectId);
                                  return (
                                    <Text key={effectId} style={styles.effectIcon}>
                                      {effect?.icon}
                                    </Text>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.noInitiative}>
                      <Text style={styles.noInitiativeText}>
                        Combat not started
                      </Text>
                    </View>
                  )}
                </View>

                {/* Dice roller and initiative sections will go here */}
              </View>
            </ScrollView>

            {/* Token Editor Modal */}
            <Modal
              visible={showTokenEditor}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowTokenEditor(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Edit Token</Text>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editingToken?.name}
                      onChangeText={(text) => 
                        updateToken(editingTokenPosition, { ...editingToken, name: text })
                      }
                      placeholder="Token name"
                      placeholderTextColor="#666"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>HP</Text>
                    <View style={styles.hpContainer}>
                      <TextInput
                        style={styles.input}
                        value={String(editingToken?.hp || 0)}
                        onChangeText={(text) => 
                          updateToken(editingTokenPosition, { 
                            ...editingToken, 
                            hp: parseInt(text) || 0 
                          })
                        }
                        keyboardType="numeric"
                        placeholder="Current HP"
                        placeholderTextColor="#666"
                      />
                      <Text style={styles.label}> / </Text>
                      <TextInput
                        style={styles.input}
                        value={String(editingToken?.maxHp || 0)}
                        onChangeText={(text) => 
                          updateToken(editingTokenPosition, { 
                            ...editingToken, 
                            maxHp: parseInt(text) || 0 
                          })
                        }
                        keyboardType="numeric"
                        placeholder="Max HP"
                        placeholderTextColor="#666"
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Initiative Bonus</Text>
                    <TextInput
                      style={styles.input}
                      value={String(editingToken?.initiativeBonus || 0)}
                      onChangeText={(text) => 
                        updateToken(editingTokenPosition, { 
                          ...editingToken, 
                          initiativeBonus: parseInt(text) || 0 
                        })
                      }
                      keyboardType="numeric"
                      placeholder="Initiative bonus"
                      placeholderTextColor="#666"
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.deleteButton]}
                      onPress={() => {
                        deleteToken(editingTokenPosition);
                        setShowTokenEditor(false);
                      }}
                    >
                      <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.effectsButton]}
                      onPress={() => setShowEffectsPicker(true)}
                    >
                      <Text style={styles.buttonText}>Effects</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.closeButton]}
                      onPress={() => setShowTokenEditor(false)}
                    >
                      <Text style={styles.buttonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Effects Picker Modal */}
            <Modal
              visible={showEffectsPicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowEffectsPicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Status Effects</Text>
                  
                  <ScrollView style={styles.effectsList}>
                    {STATUS_EFFECTS.map(effect => {
                      const isActive = editingToken?.effects?.includes(effect.id);
                      
                      return (
                        <TouchableOpacity
                          key={effect.id}
                          style={[
                            styles.effectItem,
                            isActive && styles.activeEffect
                          ]}
                          onPress={() => {
                            const newEffects = isActive
                              ? editingToken.effects.filter(id => id !== effect.id)
                              : [...(editingToken.effects || []), effect.id];
                            
                            updateToken(editingTokenPosition, {
                              ...editingToken,
                              effects: newEffects
                            });
                          }}
                        >
                          <Text style={styles.effectIcon}>{effect.icon}</Text>
                          <Text style={styles.effectName}>{effect.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.button, styles.closeButton]}
                    onPress={() => setShowEffectsPicker(false)}
                  >
                    <Text style={styles.buttonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Party Loot Manager Modal */}
            <Modal
              visible={showLootManager}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowLootManager(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, styles.lootManagerContent]}>
                  <Text style={styles.modalTitle}>Party Loot</Text>

                  {/* Currency Section */}
                  <View style={styles.currencySection}>
                    <Text style={styles.sectionTitle}>Currency</Text>
                    <View style={styles.currencyGrid}>
                      {CURRENCY.map(type => (
                        <View key={type} style={styles.currencyItem}>
                          <Text style={styles.currencyLabel}>{type}</Text>
                          <View style={styles.currencyControls}>
                            <TouchableOpacity
                              style={styles.currencyButton}
                              onPress={() => updateCurrency(type, -1)}
                            >
                              <Text style={styles.buttonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.currencyValue}>
                              {partyLoot.currency[type] || 0}
                            </Text>
                            <TouchableOpacity
                              style={styles.currencyButton}
                              onPress={() => updateCurrency(type, 1)}
                            >
                              <Text style={styles.buttonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Items Section */}
                  <View style={styles.itemsSection}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    <View style={styles.addItemForm}>
                      <TextInput
                        style={[styles.input, styles.itemInput]}
                        placeholder="Add new item..."
                        placeholderTextColor="#666"
                        onSubmitEditing={(e) => {
                          if (e.nativeEvent.text.trim()) {
                            addLootItem({ name: e.nativeEvent.text.trim() });
                            e.target.value = '';
                          }
                        }}
                      />
                    </View>
                    <ScrollView style={styles.itemsList}>
                      {partyLoot.items.map(item => (
                        <View key={item.id} style={styles.itemRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeLootItem(item.id)}
                          >
                            <Text style={styles.removeButtonText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>

                  <TouchableOpacity
                    style={[styles.button, styles.closeButton]}
                    onPress={() => setShowLootManager(false)}
                  >
                    <Text style={styles.buttonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </>
        )}
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
  },
  // Initiative section styles
  initiativeSection: {
    flex: 1,
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: 15,
    marginTop: isSmallScreen ? 20 : 0,
  },
  initiativeList: {
    maxHeight: 400,
  },
  initiativeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 5,
    backgroundColor: THEME.secondary,
    marginBottom: 8,
  },
  currentTurn: {
    backgroundColor: THEME.accent,
  },
  initiativeLeft: {
    flex: 1,
  },
  initiativeName: {
    color: THEME.text.light,
    fontSize: 16,
    fontWeight: 'bold',
  },
  initiativeDetails: {
    color: THEME.text.light,
    opacity: 0.7,
    fontSize: 14,
  },
  effectsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  effectIcon: {
    fontSize: 20,
  },
  noInitiative: {
    padding: 20,
    alignItems: 'center',
  },
  noInitiativeText: {
    color: THEME.text.light,
    opacity: 0.5,
    fontSize: 16,
  },
  // Grid styles
  gridSection: {
    flex: 2,
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: 15,
  },
  gridContainer: {
    aspectRatio: 1,
  },
  gridRow: {
    flexDirection: 'row',
    flex: 1,
  },
  gridCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridHeader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.secondary,
  },
  gridHeaderText: {
    color: THEME.text.light,
    fontSize: 12,
  },
  tokenText: {
    color: THEME.text.light,
    fontSize: 12,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    color: THEME.text.light,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  // Form styles
  formGroup: {
    marginBottom: 15,
  },
  label: {
    color: THEME.text.light,
    marginBottom: 5,
  },
  input: {
    backgroundColor: THEME.secondary,
    color: THEME.text.light,
    padding: 10,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: THEME.danger,
  },
  effectsButton: {
    backgroundColor: THEME.accent,
  },
  closeButton: {
    backgroundColor: THEME.secondary,
  },
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: THEME.secondary,
  },
  title: {
    color: THEME.text.light,
    fontSize: 20,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    backgroundColor: THEME.accent,
    padding: 10,
    borderRadius: 5,
  },
  activeButton: {
    backgroundColor: THEME.danger,
  },
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