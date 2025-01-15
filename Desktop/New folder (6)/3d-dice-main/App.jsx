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
const DICE_TYPES = [
  { sides: 4, color: '#FF6B6B' },
  { sides: 6, color: '#4ECDC4' },
  { sides: 8, color: '#45B7D1' },
  { sides: 10, color: '#96CEB4' },
  { sides: 12, color: '#FFEEAD' },
  { sides: 20, color: '#D4A5A5' },
  { sides: 100, color: '#9B59B6' }
];
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

// Add this near your other constants
const ENEMY_TEMPLATES = {
  // Basic enemies
  Bandit: {
    name: 'Bandit',
    hp: 11,
    maxHp: 11,
    ac: 12,
    initiativeBonus: 1,
    color: '#8B4513'
  },
  Wolf: {
    name: 'Wolf',
    hp: 11,
    maxHp: 11,
    ac: 13,
    initiativeBonus: 2,
    color: '#808080'
  },
  Wraith: {
    name: 'Wraith',
    hp: 67,
    maxHp: 67,
    ac: 13,
    initiativeBonus: 3,
    color: '#4A0404'
  },
  Goblin: {
    name: 'Goblin',
    hp: 7,
    maxHp: 7,
    ac: 15,
    initiativeBonus: 2,
    color: '#355E3B'
  },
  Skeleton: {
    name: 'Skeleton',
    hp: 13,
    maxHp: 13,
    ac: 13,
    initiativeBonus: 2,
    color: '#E1D9D1'
  },
  // Add more enemies as needed
};

// Get window dimensions
const windowDimensions = Dimensions.get('window');
const isSmallScreen = windowDimensions.width < 768;

// Theme configuration
const THEME = {
  primary: '#1E1E1E',
  secondary: '#2D2D2D',
  accent: '#7289DA',
  gold: '#FFD700',
  danger: '#ED4245',
  success: '#3BA55C',
  text: {
    light: '#FFFFFF',
    dark: '#1E1E1E'
  },
  background: {
    primary: '#1E1E1E',
    secondary: '#2D2D2D',
    dark: '#141414',
    panel: '#363636'
  }
};

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

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background.primary,
    height: '100%',
    width: '100%',
  },
  header: {
    padding: isSmallScreen ? 10 : 20,
    backgroundColor: THEME.background.panel,
    width: '100%',
  },
  title: {
    fontSize: isSmallScreen ? 18 : 24,
    fontWeight: 'bold',
    color: THEME.text.light,
    marginBottom: 10,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: isSmallScreen ? 'center' : 'flex-start',
  },
  controlButton: {
    padding: isSmallScreen ? 8 : 10,
    borderRadius: 5,
    minWidth: isSmallScreen ? 80 : 100,
    alignItems: 'center',
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
    minHeight: '100%',
  },
  gridSection: {
    flex: 1,
    minHeight: isSmallScreen ? 400 : '100%',
  },
  sidebar: {
    width: isSmallScreen ? '100%' : 350,
    flexShrink: 0,
  },
  gridContainer: {
    padding: isSmallScreen ? 5 : 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: isSmallScreen ? 35 : 60,
    height: isSmallScreen ? 35 : 60,
    borderWidth: 1,
    borderColor: THEME.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background.secondary,
  },
  tokenContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: isSmallScreen ? 1 : 2,
  },
  tokenText: {
    fontSize: isSmallScreen ? 10 : 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tokenHp: {
    fontSize: isSmallScreen ? 8 : 10,
    textAlign: 'center',
  },
  tokenAc: {
    fontSize: isSmallScreen ? 8 : 10,
    textAlign: 'center',
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.background.panel,
    padding: 20,
    borderRadius: 10,
    width: isSmallScreen ? '90%' : 400,
  },
  modalTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: 'bold',
    color: THEME.text.light,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.accent,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    color: THEME.text.light,
    backgroundColor: THEME.background.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    color: THEME.text.light,
    fontWeight: 'bold',
    fontSize: isSmallScreen ? 12 : 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background.primary,
    width: '100%',
    height: '100%',
  },
  loadingText: {
    color: THEME.text.light,
    fontSize: 16,
    marginTop: 10,
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceBox: {
    width: '100%',
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: isSmallScreen ? 8 : 15,
  },
  diceControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'center',
  },
  diceButton: {
    padding: isSmallScreen ? 5 : 10,
    backgroundColor: THEME.primary,
    borderRadius: 5,
    alignItems: 'center',
    minWidth: isSmallScreen ? 30 : 60,
  },
  diceHistory: {
    maxHeight: isSmallScreen ? 100 : 200,
    marginTop: 10,
  },
  diceResultContainer: {
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: THEME.accent + '40',
  },
  diceResult: {
    color: THEME.text.light,
  },
  diceTotal: {
    fontWeight: 'bold',
    color: THEME.accent,
  },
  diceRolls: {
    color: THEME.text.light + '80',
    fontSize: 12,
  },
  initiativeList: {
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: isSmallScreen ? 8 : 15,
    width: '100%',
  },
  initiativeScroll: {
    maxHeight: isSmallScreen ? 150 : 200,
  },
  initiativeItem: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 5,
    backgroundColor: THEME.background.primary,
  },
  currentInitiative: {
    backgroundColor: THEME.accent,
  },
  initiativeText: {
    color: THEME.text.light,
  },
  currentInitiativeText: {
    color: THEME.text.dark,
    fontWeight: 'bold',
  },
  zoomControls: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 10,
    display: isSmallScreen ? 'flex' : 'none',
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.background.panel,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  advantageButton: {
    backgroundColor: THEME.background.primary,
    padding: 8,
    borderRadius: 5,
  },
  advantageActive: {
    backgroundColor: THEME.accent,
  },
  modifierInput: {
    backgroundColor: THEME.background.primary,
    color: THEME.text.light,
    padding: 8,
    borderRadius: 5,
    width: 60,
    textAlign: 'center',
  },
  boxTitle: {
    color: THEME.text.light,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: isSmallScreen ? 2 : 5,
    marginBottom: isSmallScreen ? 5 : 10,
  },
  colorButton: {
    width: isSmallScreen ? 20 : 30,
    height: isSmallScreen ? 20 : 30,
    borderRadius: isSmallScreen ? 10 : 15,
    margin: isSmallScreen ? 1 : 2,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: THEME.accent,
  },
  enemyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.background.secondary,
  },
  enemyColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  enemyInfo: {
    flex: 1,
  },
  enemyName: {
    color: THEME.text.light,
    fontSize: 16,
    fontWeight: 'bold',
  },
  enemyStats: {
    color: THEME.text.light,
    opacity: 0.7,
    fontSize: 12,
  },
});

const additionalStyles = StyleSheet.create({
  characterSheet: {
    backgroundColor: THEME.background.panel,
    padding: 20,
    borderRadius: 10,
    width: isSmallScreen ? '95%' : '80%',
    maxWidth: 800,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text.light,
    marginBottom: 10,
  },
  abilityScores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 10,
  },
  abilityBox: {
    backgroundColor: THEME.background.primary,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: isSmallScreen ? '30%' : 100,
    marginBottom: 10,
  },
  abilityLabel: {
    color: THEME.text.light,
    fontWeight: 'bold',
  },
  abilityScore: {
    color: THEME.accent,
    fontSize: 24,
    fontWeight: 'bold',
    width: '100%',
    textAlign: 'center',
    padding: 5,
  },
  abilityMod: {
    color: THEME.text.light,
  },
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.background.primary,
    padding: 8,
    borderRadius: 5,
    minWidth: isSmallScreen ? '45%' : 200,
  },
  proficientDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  skillName: {
    color: THEME.text.light,
    flex: 1,
  },
  skillMod: {
    color: THEME.accent,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
  },
  closeButtonText: {
    color: THEME.text.light,
    fontSize: 20,
  },
  lootSection: {
    backgroundColor: THEME.background.primary,
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencyInput: {
    backgroundColor: THEME.background.secondary,
    color: THEME.text.light,
    padding: 8,
    borderRadius: 5,
    width: 80,
    textAlign: 'center',
  },
  currencyLabel: {
    color: THEME.text.light,
    width: 30,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  itemInput: {
    flex: 1,
    backgroundColor: THEME.background.secondary,
    color: THEME.text.light,
    padding: 8,
    borderRadius: 5,
  },
  removeButton: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: THEME.danger,
  },
  addButton: {
    backgroundColor: THEME.success,
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  lootHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  addedBy: {
    color: THEME.text.light,
    opacity: 0.6,
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    gap: 10,
  },
  statBox: {
    backgroundColor: THEME.background.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: isSmallScreen ? '30%' : 100,
  },
  statLabel: {
    color: THEME.text.light,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statValue: {
    color: THEME.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statInput: {
    backgroundColor: THEME.background.secondary,
    color: THEME.text.light,
    padding: 8,
    borderRadius: 5,
    width: '100%',
    textAlign: 'center',
    fontSize: 20,
    marginTop: 5,
  },
  currentHp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hpSeparator: {
    color: THEME.text.light,
    fontSize: 20,
  },
});

const diceStyles = StyleSheet.create({
  dicePanel: {
    backgroundColor: THEME.background.panel,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  diceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  diceTitle: {
    color: THEME.text.light,
    fontSize: 18,
    fontWeight: 'bold',
  },
  diceControls: {
    backgroundColor: THEME.background.primary,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    gap: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    backgroundColor: THEME.background.secondary,
    padding: 8,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  controlActive: {
    backgroundColor: THEME.accent,
  },
  modifierGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modifierLabel: {
    color: THEME.text.light,
    fontSize: 14,
  },
  modifierInput: {
    backgroundColor: THEME.background.secondary,
    color: THEME.text.light,
    padding: 8,
    borderRadius: 5,
    width: 50,
    textAlign: 'center',
  },
  quantityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quantityLabel: {
    color: THEME.text.light,
    fontSize: 14,
  },
  quantityInput: {
    backgroundColor: THEME.background.secondary,
    color: THEME.text.light,
    padding: 8,
    borderRadius: 5,
    width: 50,
    textAlign: 'center',
  },
  diceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 15,
  },
  diceButton: {
    width: isSmallScreen ? 45 : 60,
    height: isSmallScreen ? 45 : 60,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceButtonText: {
    color: THEME.text.light,
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: 'bold',
  },
  historyContainer: {
    backgroundColor: THEME.background.primary,
    borderRadius: 8,
    maxHeight: 200,
  },
  historyScroll: {
    padding: 10,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.background.secondary,
  },
  historyLeft: {
    flex: 1,
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  historyDice: {
    color: THEME.text.light,
    opacity: 0.7,
  },
  historyRolls: {
    color: THEME.text.light,
    fontSize: 12,
    opacity: 0.5,
  },
  historyTotal: {
    color: THEME.accent,
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: THEME.background.secondary,
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
});

const statusStyles = StyleSheet.create({
  effectsContainer: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: THEME.accent + '40',
    paddingTop: 15,
  },
  effectsTitle: {
    color: THEME.text.light,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effectButton: {
    backgroundColor: THEME.background.primary,
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
    minWidth: 80,
  },
  effectActive: {
    backgroundColor: THEME.accent,
  },
  effectText: {
    color: THEME.text.light,
    fontSize: 12,
  },
  tokenEffects: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 2,
  },
  effectIcon: {
    fontSize: isSmallScreen ? 10 : 12,
  },
});

// Create a helper function to save game state
const saveGameState = async () => {
  if (firebaseRef.current) {
    try {
      await set(firebaseRef.current, {
        tokens,
        layers,
        initiative,
        inCombat,
        currentTurn,
        partyLoot,
        characters,
        settings: initialGameState.settings,
        lastUpdate: Date.now()
      });
    } catch (error) {
      console.error('Error saving game state:', error);
      Alert.alert('Error', 'Failed to save game state');
    }
  }
};

// Add this component definition before the TokenModal component
const CharacterSheetModal = memo(({ visible, onClose, character, characters, onUpdate }) => {
  const [editedCharacter, setEditedCharacter] = useState(() => ({
    name: character?.name || '',
    class: character?.class || '',
    level: character?.level || 1,
    owner: character?.owner || '',
    proficiencyBonus: character?.proficiencyBonus || 2,
    abilityScores: character?.abilityScores || {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10
    },
    proficientSkills: character?.proficientSkills || [],
    currency: character?.currency || {
      CP: 0,
      SP: 0,
      EP: 0,
      GP: 0,
      PP: 0
    },
    items: character?.items || [],
    inventory: character?.inventory || [],
    hp: character?.hp || 0,
    maxHp: character?.maxHp || 0,
    ac: character?.ac || 10,
  }));

  useEffect(() => {
    if (visible && character) {
      setEditedCharacter({
        name: character.name || '',
        class: character.class || '',
        level: character.level || 1,
        owner: character.owner || '',
        proficiencyBonus: character.proficiencyBonus || 2,
        abilityScores: character.abilityScores || {
          STR: 10,
          DEX: 10,
          CON: 10,
          INT: 10,
          WIS: 10,
          CHA: 10
        },
        proficientSkills: character.proficientSkills || [],
        currency: character.currency || {
          CP: 0,
          SP: 0,
          EP: 0,
          GP: 0,
          PP: 0
        },
        items: character.items || [],
        inventory: character.inventory || [],
        hp: character.hp || 0,
        maxHp: character.maxHp || 0,
        ac: character.ac || 10,
      });
    }
  }, [visible, character]);

  // Add error boundary
  if (!character) {
    console.error('No character data provided to CharacterSheetModal');
    return null;
  }

  const calculateModifier = (score) => {
    return Math.floor((score - 10) / 2);
  };

  const handleAbilityScoreChange = (ability, value) => {
    const newScore = parseInt(value) || 0;
    setEditedCharacter(prev => ({
      ...prev,
      abilityScores: {
        ...prev.abilityScores,
        [ability]: newScore
      }
    }));
  };

  const toggleProficiency = (skill) => {
    setEditedCharacter(prev => ({
      ...prev,
      proficientSkills: prev.proficientSkills.includes(skill)
        ? prev.proficientSkills.filter(s => s !== skill)
        : [...prev.proficientSkills, skill]
    }));
  };

  const getSkillModifier = (skill, ability) => {
    const abilityMod = calculateModifier(editedCharacter.abilityScores[ability]);
    const profBonus = editedCharacter.proficientSkills.includes(skill) ? editedCharacter.proficiencyBonus : 0;
    return abilityMod + profBonus;
  };

  const handleSave = async () => {
    try {
      const updatedCharacter = {
        ...character,
        ...editedCharacter
      };

      onUpdate(updatedCharacter);
    } catch (error) {
      console.error('Error saving character:', error);
      Alert.alert('Error', 'Failed to save character');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={additionalStyles.characterSheet}>
          <TouchableOpacity 
            style={additionalStyles.closeButton}
            onPress={onClose}
          >
            <Text style={additionalStyles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <GestureScrollView>
            {/* Basic Info */}
            <View style={additionalStyles.sheetSection}>
              <Text style={additionalStyles.sectionTitle}>Character Info</Text>
              <TextInput
                style={styles.input}
                value={editedCharacter.name}
                onChangeText={(text) => setEditedCharacter(prev => ({...prev, name: text}))}
                placeholder="Character Name"
                placeholderTextColor={THEME.text.light + '80'}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={editedCharacter.class}
                  onChangeText={(text) => setEditedCharacter(prev => ({...prev, class: text}))}
                  placeholder="Class"
                  placeholderTextColor={THEME.text.light + '80'}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={String(editedCharacter.level)}
                  onChangeText={(text) => setEditedCharacter(prev => ({...prev, level: parseInt(text) || 1}))}
                  placeholder="Level"
                  keyboardType="numeric"
                  placeholderTextColor={THEME.text.light + '80'}
                />
              </View>
            </View>

            {/* HP and AC Section */}
            <View style={additionalStyles.sheetSection}>
              <View style={additionalStyles.statsRow}>
                <View style={additionalStyles.statBox}>
                  <Text style={additionalStyles.statLabel}>Hit Points</Text>
                  <View style={additionalStyles.currentHp}>
                    <TextInput
                      style={additionalStyles.statInput}
                      value={String(editedCharacter.hp)}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setEditedCharacter(prev => ({
                          ...prev,
                          hp: value
                        }));
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                      placeholder="Current"
                      placeholderTextColor={THEME.text.light + '80'}
                    />
                    <Text style={additionalStyles.hpSeparator}>/</Text>
                    <TextInput
                      style={additionalStyles.statInput}
                      value={String(editedCharacter.maxHp)}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setEditedCharacter(prev => ({
                          ...prev,
                          maxHp: value
                        }));
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                      placeholder="Max"
                      placeholderTextColor={THEME.text.light + '80'}
                    />
                  </View>
                </View>

                <View style={additionalStyles.statBox}>
                  <Text style={additionalStyles.statLabel}>Armor Class</Text>
                  <TextInput
                    style={additionalStyles.statInput}
                    value={String(editedCharacter.ac)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setEditedCharacter(prev => ({
                        ...prev,
                        ac: value
                      }));
                    }}
                    keyboardType="numeric"
                    selectTextOnFocus={true}
                    placeholder="AC"
                    placeholderTextColor={THEME.text.light + '80'}
                  />
                </View>
              </View>
            </View>

            {/* Ability Scores */}
            <View style={additionalStyles.sheetSection}>
              <Text style={additionalStyles.sectionTitle}>Ability Scores</Text>
              <View style={additionalStyles.abilityScores}>
                {ABILITY_SCORES.map(ability => (
                  <View key={ability} style={additionalStyles.abilityBox}>
                    <Text style={additionalStyles.abilityLabel}>{ability}</Text>
                    <TextInput
                      style={additionalStyles.abilityScore}
                      value={String(editedCharacter.abilityScores[ability])}
                      onChangeText={(text) => handleAbilityScoreChange(ability, text)}
                      keyboardType="numeric"
                      maxLength={2}
                      selectTextOnFocus={true}
                    />
                    <Text style={additionalStyles.abilityMod}>
                      {calculateModifier(editedCharacter.abilityScores[ability]) >= 0 ? '+' : ''}
                      {calculateModifier(editedCharacter.abilityScores[ability])}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Skills */}
            <View style={additionalStyles.sheetSection}>
              <Text style={additionalStyles.sectionTitle}>Skills</Text>
              <View style={additionalStyles.skillsList}>
                {Object.entries(SKILLS).map(([ability, skills]) =>
                  skills.map(skill => (
                    <TouchableOpacity
                      key={skill}
                      style={additionalStyles.skillItem}
                      onPress={() => toggleProficiency(skill)}
                    >
                      <View style={[
                        additionalStyles.proficientDot,
                        {
                          backgroundColor: editedCharacter.proficientSkills.includes(skill)
                            ? THEME.accent
                            : THEME.background.secondary
                        }
                      ]} />
                      <Text style={additionalStyles.skillName}>{skill}</Text>
                      <Text style={additionalStyles.skillMod}>
                        {getSkillModifier(skill, ability) >= 0 ? '+' : ''}
                        {getSkillModifier(skill, ability)}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>

            {/* Inventory */}
            <View style={additionalStyles.sheetSection}>
              <Text style={additionalStyles.sectionTitle}>Inventory</Text>
              
              <View style={additionalStyles.lootSection}>
                {/* Currency */}
                {CURRENCY.map(currency => (
                  <View key={currency} style={additionalStyles.currencyRow}>
                    <Text style={additionalStyles.currencyLabel}>{currency}</Text>
                    <TextInput
                      style={additionalStyles.currencyInput}
                      value={String(editedCharacter.currency[currency] || 0)}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setEditedCharacter(prev => ({
                          ...prev,
                          currency: {
                            ...prev.currency,
                            [currency]: value
                          }
                        }));
                      }}
                      keyboardType="numeric"
                      placeholderTextColor={THEME.text.light + '80'}
                    />
                  </View>
                ))}
              </View>

              <View style={additionalStyles.lootSection}>
                <View style={additionalStyles.lootHeader}>
                  <Text style={additionalStyles.sectionTitle}>Items</Text>
                  <TouchableOpacity
                    style={additionalStyles.addButton}
                    onPress={() => {
                      setEditedCharacter(prev => ({
                        ...prev,
                        items: [...prev.items, { name: '', quantity: 1, notes: '', addedBy: character.name }]
                      }));
                    }}
                  >
                    <Text style={styles.buttonText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                {editedCharacter.items.map((item, index) => (
                  <View key={index} style={additionalStyles.itemRow}>
                    <View style={additionalStyles.itemInfo}>
                      <TextInput
                        style={[additionalStyles.itemInput, { flex: 2 }]}
                        value={item.name}
                        onChangeText={(text) => {
                          const newItems = [...editedCharacter.items];
                          newItems[index] = { ...item, name: text };
                          setEditedCharacter(prev => ({ ...prev, items: newItems }));
                        }}
                        placeholder="Item name"
                        placeholderTextColor={THEME.text.light + '80'}
                      />
                      <TextInput
                        style={[additionalStyles.itemInput, { width: 60 }]}
                        value={String(item.quantity)}
                        onChangeText={(text) => {
                          const newItems = [...editedCharacter.items];
                          newItems[index] = { ...item, quantity: parseInt(text) || 1 };
                          setEditedCharacter(prev => ({ ...prev, items: newItems }));
                        }}
                        keyboardType="numeric"
                        placeholder="Qty"
                        placeholderTextColor={THEME.text.light + '80'}
                      />
                      {item.addedBy === character.name && (
                        <TouchableOpacity
                          style={additionalStyles.removeButton}
                          onPress={() => {
                            setEditedCharacter(prev => ({
                              ...prev,
                              items: prev.items.filter((_, i) => i !== index)
                            }));
                          }}
                        >
                          <Text style={styles.buttonText}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={additionalStyles.addedBy}>Added by: {item.addedBy}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: THEME.success }]}
                onPress={handleSave}
              >
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </GestureScrollView>
        </View>
      </View>
    </Modal>
  );
});

// Memoized Modal Components
const TokenModal = memo(({ 
  showTokenModal, 
  setShowTokenModal, 
  selectedToken, 
  setSelectedToken, 
  tokens, 
  firebaseRef, 
  initialGameState, 
  layers, 
  initiative, 
  inCombat, 
  currentTurn, 
  THEME 
}) => (
  <Modal
    visible={showTokenModal}
    transparent={true}
    animationType="fade"
    onRequestClose={() => setShowTokenModal(false)}
  >
    <Pressable 
      style={[styles.modalOverlay, { cursor: 'default' }]}
      onPress={() => Keyboard.dismiss()}
    >
      <View style={styles.modalContent}>
        <KeyboardAvoidingView 
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          style={styles.modalContainer}
          keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Token</Text>
            <TextInput
              style={styles.input}
              value={selectedToken?.name}
              onChangeText={(text) => {
                setSelectedToken(prev => ({
                  ...prev,
                  name: text
                }));
              }}
              placeholder="Token Name"
              placeholderTextColor={THEME.text.light + '80'}
              blurOnSubmit={false}
              autoComplete="off"
              spellCheck={false}
              selectTextOnFocus={true}
              enablesReturnKeyAutomatically={true}
            />
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={String(selectedToken?.hp || '')}
                  onChangeText={(text) => {
                    const hp = parseInt(text) || 0;
                    setSelectedToken(prev => ({
                      ...prev,
                      hp: Math.max(0, hp)
                    }));
                  }}
                  keyboardType="numeric"
                  placeholder="Current HP"
                  placeholderTextColor={THEME.text.light + '80'}
                  blurOnSubmit={false}
                  autoComplete="off"
                  selectTextOnFocus={true}
                  enablesReturnKeyAutomatically={true}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={String(selectedToken?.maxHp || '')}
                  onChangeText={(text) => {
                    const maxHp = parseInt(text) || 1;
                    setSelectedToken(prev => ({
                      ...prev,
                      maxHp: Math.max(1, maxHp)
                    }));
                  }}
                  keyboardType="numeric"
                  placeholder="Max HP"
                  placeholderTextColor={THEME.text.light + '80'}
                  blurOnSubmit={false}
                  autoComplete="off"
                  selectTextOnFocus={true}
                  enablesReturnKeyAutomatically={true}
                />
              </View>
            </View>

            <TextInput
              style={styles.input}
              value={String(selectedToken?.initiativeBonus || '0')}
              onChangeText={(text) => {
                setSelectedToken(prev => ({
                  ...prev,
                  initiativeBonus: parseInt(text) || 0
                }));
              }}
              keyboardType="numeric"
              placeholder="Initiative Bonus"
              placeholderTextColor={THEME.text.light + '80'}
              blurOnSubmit={false}
              autoComplete="off"
              selectTextOnFocus={true}
              enablesReturnKeyAutomatically={true}
            />

            <View style={statusStyles.effectsContainer}>
              <Text style={statusStyles.effectsTitle}>Status Effects</Text>
              <View style={statusStyles.effectsGrid}>
                {STATUS_EFFECTS.map(effect => (
                  <TouchableOpacity
                    key={effect.id}
                    style={[
                      statusStyles.effectButton,
                      selectedToken?.effects?.includes(effect.id) && statusStyles.effectActive
                    ]}
                    onPress={() => {
                      setSelectedToken(prev => {
                        const currentEffects = prev.effects || [];
                        const newEffects = currentEffects.includes(effect.id)
                          ? currentEffects.filter(e => e !== effect.id)
                          : [...currentEffects, effect.id];
                        return {
                          ...prev,
                          effects: newEffects
                        };
                      });
                    }}
                  >
                    <Text style={statusStyles.effectText}>
                      {effect.icon} {effect.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: THEME.danger }]}
                onPress={() => {
                  if (firebaseRef.current && selectedToken) {
                    const newTokens = { ...tokens };
                    delete newTokens[selectedToken.position];
                    set(firebaseRef.current, { 
                      ...initialGameState,
                      tokens: newTokens,
                      layers,
                      initiative,
                      inCombat,
                      currentTurn
                    });
                    setShowTokenModal(false);
                  }
                }}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: THEME.success }]}
                onPress={() => {
                  if (firebaseRef.current && selectedToken) {
                    const newTokens = {
                      ...tokens,
                      [selectedToken.position]: selectedToken
                    };
                    set(firebaseRef.current, {
                      ...initialGameState,
                      tokens: newTokens,
                      layers,
                      initiative,
                      inCombat,
                      currentTurn
                    });
                    setShowTokenModal(false);
                  }
                }}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Pressable>
  </Modal>
));

// Update the RoomModal styles
const modalStyles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Add high z-index
  },
  modalContent: {
    backgroundColor: THEME.background.panel,
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    zIndex: 1001, // Even higher z-index
  },
});

// Update the RoomModal component
const RoomModal = memo(({ 
  showRoomModal, 
  setShowRoomModal, 
  isConnected, 
  roomCode, 
  setRoomCode, 
  isJoining, 
  connectToRoom 
}) => (
  <Modal
    visible={showRoomModal}
    transparent={true}
    animationType="fade"
    onRequestClose={() => {}}
    style={{ zIndex: 999 }} // Add z-index to Modal
  >
    <View style={[modalStyles.modalOverlay, { pointerEvents: 'auto' }]}>
      <View style={modalStyles.modalContent}>
        <Text style={styles.modalTitle}>Join Room</Text>
        <TextInput
          style={[styles.input, { marginBottom: 15, zIndex: 1002 }]} // Add z-index to input
          value={roomCode}
          onChangeText={(text) => {
            setRoomCode(text.trim().toLowerCase());
          }}
          placeholder="Enter room code..."
          placeholderTextColor={THEME.text.light + '80'}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isJoining}
          autoFocus={true}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.modalButton,
            { 
              backgroundColor: isJoining ? THEME.background.secondary : THEME.success,
              width: '100%',
              zIndex: 1002 // Add z-index to button
            }
          ]}
          onPress={() => {
            Keyboard.dismiss();
            connectToRoom(roomCode);
          }}
          disabled={isJoining}
        >
          {isJoining ? (
            <View style={styles.loadingButtonContent}>
              <ActivityIndicator color={THEME.text.light} />
              <Text style={[styles.buttonText, { marginLeft: 10 }]}>
                Connecting...
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Join Room</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
));

const PartyLootModal = memo(({ visible, onClose, partyLoot, onUpdate, playerName }) => {
  const [editedLoot, setEditedLoot] = useState({
    currency: {
      CP: 0,
      SP: 0,
      EP: 0,
      GP: 0,
      PP: 0
    },
    items: []
  });

  useEffect(() => {
    if (visible && partyLoot) {
      setEditedLoot({
        currency: partyLoot.currency || {
          CP: 0,
          SP: 0,
          EP: 0,
          GP: 0,
          PP: 0
        },
        items: partyLoot.items || []
      });
    }
  }, [visible, partyLoot]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <Text style={styles.modalTitle}>Party Loot</Text>
          
          <ScrollView>
            {/* Currency Section */}
            <View style={additionalStyles.lootSection}>
              {CURRENCY.map(type => (
                <View key={type} style={additionalStyles.currencyRow}>
                  <Text style={additionalStyles.currencyLabel}>{type}</Text>
                  <TextInput
                    style={additionalStyles.currencyInput}
                    value={String(editedLoot.currency[type] || 0)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setEditedLoot(prev => ({
                        ...prev,
                        currency: {
                          ...prev.currency,
                          [type]: value
                        }
                      }));
                    }}
                    keyboardType="numeric"
                    placeholderTextColor={THEME.text.light + '80'}
                  />
                </View>
              ))}
            </View>

            {/* Items Section */}
            <View style={additionalStyles.lootSection}>
              <View style={additionalStyles.lootHeader}>
                <Text style={additionalStyles.sectionTitle}>Items</Text>
                <TouchableOpacity
                  style={additionalStyles.addButton}
                  onPress={() => {
                    setEditedLoot(prev => ({
                      ...prev,
                      items: [...prev.items, { 
                        id: Date.now().toString(),
                        name: '',
                        quantity: 1,
                        addedBy: playerName 
                      }]
                    }));
                  }}
                >
                  <Text style={styles.buttonText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {editedLoot.items.map((item, index) => (
                <View key={item.id || index} style={additionalStyles.itemRow}>
                  <TextInput
                    style={[additionalStyles.itemInput, { flex: 2 }]}
                    value={item.name}
                    onChangeText={(text) => {
                      const newItems = [...editedLoot.items];
                      newItems[index] = { ...item, name: text };
                      setEditedLoot(prev => ({ ...prev, items: newItems }));
                    }}
                    placeholder="Item name"
                    placeholderTextColor={THEME.text.light + '80'}
                  />
                  <TextInput
                    style={[additionalStyles.itemInput, { width: 60 }]}
                    value={String(item.quantity)}
                    onChangeText={(text) => {
                      const newItems = [...editedLoot.items];
                      newItems[index] = { ...item, quantity: parseInt(text) || 1 };
                      setEditedLoot(prev => ({ ...prev, items: newItems }));
                    }}
                    keyboardType="numeric"
                    placeholder="Qty"
                    placeholderTextColor={THEME.text.light + '80'}
                  />
                  <TouchableOpacity
                    style={additionalStyles.removeButton}
                    onPress={() => {
                      setEditedLoot(prev => ({
                        ...prev,
                        items: prev.items.filter((_, i) => i !== index)
                      }));
                    }}
                  >
                    <Text style={styles.buttonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: THEME.success }]}
              onPress={() => {
                onUpdate(editedLoot);
                onClose();
              }}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// Add this component definition before the App component
const GridZoomControls = memo(({ zoomLevel, setZoomLevel }) => {
  const debouncedZoom = debounce((newZoom) => {
    setZoomLevel(newZoom);
  }, 100);

  return (
    <View style={styles.zoomControls}>
      <TouchableOpacity
        style={styles.zoomButton}
        onPress={() => debouncedZoom(Math.max(0.5, zoomLevel - 0.1))}
      >
        <Text style={styles.buttonText}>-</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.zoomButton}
        onPress={() => debouncedZoom(Math.min(2, zoomLevel + 0.1))}
      >
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
});

// Add InventoryModal component
const InventoryModal = memo(({ visible, onClose, character, onUpdate }) => {
  const [editedInventory, setEditedInventory] = useState({
    currency: character?.currency || {
      CP: 0,
      SP: 0,
      EP: 0,
      GP: 0,
      PP: 0
    },
    inventory: character?.inventory || []
  });

  useEffect(() => {
    if (visible && character) {
      setEditedInventory({
        currency: character.currency || {
          CP: 0,
          SP: 0,
          EP: 0,
          GP: 0,
          PP: 0
        },
        inventory: character.inventory || []
      });
    }
  }, [visible, character]);

  if (!visible || !character) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={additionalStyles.characterSheet}>
          <TouchableOpacity 
            style={additionalStyles.closeButton}
            onPress={onClose}
          >
            <Text style={additionalStyles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <Text style={additionalStyles.sectionTitle}>{character.name}'s Inventory</Text>

          <GestureScrollView>
            <View style={additionalStyles.lootSection}>
              {/* Currency */}
              {CURRENCY.map(currency => (
                <View key={currency} style={additionalStyles.currencyRow}>
                  <Text style={additionalStyles.currencyLabel}>{currency}</Text>
                  <TextInput
                    style={additionalStyles.currencyInput}
                    value={String(editedInventory.currency[currency] || 0)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setEditedInventory(prev => ({
                        ...prev,
                        currency: {
                          ...prev.currency,
                          [currency]: value
                        }
                      }));
                    }}
                    keyboardType="numeric"
                    placeholderTextColor={THEME.text.light + '80'}
                  />
                </View>
              ))}
            </View>

            <View style={additionalStyles.lootSection}>
              <View style={additionalStyles.lootHeader}>
                <Text style={additionalStyles.sectionTitle}>Items</Text>
                <TouchableOpacity
                  style={additionalStyles.addButton}
                  onPress={() => {
                    setEditedInventory(prev => ({
                      ...prev,
                      inventory: [...prev.inventory, { name: '', quantity: 1, notes: '', addedBy: character.name }]
                    }));
                  }}
                >
                  <Text style={styles.buttonText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {editedInventory.inventory.map((item, index) => (
                <View key={index} style={additionalStyles.itemRow}>
                  <View style={additionalStyles.itemInfo}>
                    <TextInput
                      style={[additionalStyles.itemInput, { flex: 2 }]}
                      value={item.name}
                      onChangeText={(text) => {
                        const newInventory = [...editedInventory.inventory];
                        newInventory[index] = { ...item, name: text };
                        setEditedInventory(prev => ({ ...prev, inventory: newInventory }));
                      }}
                      placeholder="Item name"
                      placeholderTextColor={THEME.text.light + '80'}
                    />
                    <TextInput
                      style={[additionalStyles.itemInput, { width: 60 }]}
                      value={String(item.quantity)}
                      onChangeText={(text) => {
                        const newInventory = [...editedInventory.inventory];
                        newInventory[index] = { ...item, quantity: parseInt(text) || 1 };
                        setEditedInventory(prev => ({ ...prev, inventory: newInventory }));
                      }}
                      keyboardType="numeric"
                      placeholder="Qty"
                      placeholderTextColor={THEME.text.light + '80'}
                    />
                    {item.addedBy === character.name && (
                      <TouchableOpacity
                        style={additionalStyles.removeButton}
                        onPress={() => {
                          setEditedInventory(prev => ({
                            ...prev,
                            inventory: prev.inventory.filter((_, i) => i !== index)
                          }));
                        }}
                      >
                        <Text style={styles.buttonText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={additionalStyles.addedBy}>Added by: {item.addedBy}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: THEME.success }]}
              onPress={() => {
                onUpdate({
                  ...character,
                  currency: editedInventory.currency,
                  inventory: editedInventory.inventory
                });
                onClose();
              }}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>
          </GestureScrollView>
        </View>
      </View>
    </Modal>
  );
});

// Add PlayerNameModal component
const PlayerNameModal = memo(({ visible, onSubmit }) => {
  const [name, setName] = useState('');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Your Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={THEME.text.light + '80'}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[styles.modalButton, { 
              backgroundColor: THEME.success,
              width: '100%',
              marginTop: 10
            }]}
            onPress={() => onSubmit(name)}
            disabled={!name.trim()}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

// Add to styles
const viewerStyles = StyleSheet.create({
  viewersList: {
    marginTop: 15,
    padding: 10,
    backgroundColor: THEME.background.primary,
    borderRadius: 5,
  },
  viewersTitle: {
    color: THEME.text.light,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  viewerName: {
    color: THEME.text.light,
    opacity: 0.8,
    fontSize: 12,
    marginBottom: 2,
  },
});

// Add this new component near the top with other components
const DiceResultOverlay = memo(({ result, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000); // Auto-hide after 2 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!result) return null;

  return (
    <View style={overlayStyles.container}>
      <View style={overlayStyles.content}>
        <Text style={overlayStyles.diceInfo}>
          {result.dice}
          {result.modifier ? ` + ${result.modifier}` : ''}
          {result.rollType === 'advantage' ? ' (Adv)' : 
           result.rollType === 'disadvantage' ? ' (Dis)' : ''}
        </Text>
        {result.individualTotals && result.individualTotals.length > 1 && (
          <Text style={overlayStyles.rolls}>
            [{result.individualTotals.join(', ')}]
          </Text>
        )}
        <Text style={overlayStyles.total}>{result.total}</Text>
      </View>
    </View>
  );
});

// Add these styles
const overlayStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: THEME.background.panel,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 150,
  },
  diceInfo: {
    color: THEME.text.light,
    fontSize: 18,
    marginBottom: 5,
  },
  rolls: {
    color: THEME.text.light,
    opacity: 0.7,
    marginBottom: 5,
  },
  total: {
    color: THEME.accent,
    fontSize: 32,
    fontWeight: 'bold',
  },
});

// Add this new component near the other modal components
const DeleteCharacterModal = memo(({ visible, character, onClose, onConfirm }) => {
  const [confirmName, setConfirmName] = useState('');
  
  useEffect(() => {
    if (visible) {
      setConfirmName('');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 400 }]}>
          <Text style={styles.modalTitle}>Delete Character</Text>
          
          <Text style={deleteStyles.warningText}>
            This action cannot be undone. To confirm deletion, please type the character's name:
          </Text>
          <Text style={deleteStyles.characterName}>{character?.name}</Text>
          
          <TextInput
            style={[styles.input, { marginTop: 15 }]}
            value={confirmName}
            onChangeText={setConfirmName}
            placeholder="Type character name to confirm"
            placeholderTextColor={THEME.text.light + '80'}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: THEME.background.secondary }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: THEME.danger },
                confirmName !== character?.name && { opacity: 0.5 }
              ]}
              onPress={() => {
                if (confirmName === character?.name) {
                  onConfirm();
                }
              }}
              disabled={confirmName !== character?.name}
            >
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// Add these styles
const deleteStyles = StyleSheet.create({
  warningText: {
    color: THEME.text.light,
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  characterName: {
    color: THEME.danger,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

// Add this new component for enemy selection
const EnemySelectModal = memo(({ visible, onClose, onSelect }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>Select Enemy</Text>
          <ScrollView>
            {Object.entries(ENEMY_TEMPLATES).map(([key, enemy]) => (
              <TouchableOpacity
                key={key}
                style={styles.enemyOption}
                onPress={() => onSelect(enemy)}
              >
                <View style={[styles.enemyColor, { backgroundColor: enemy.color }]} />
                <View style={styles.enemyInfo}>
                  <Text style={styles.enemyName}>{enemy.name}</Text>
                  <Text style={styles.enemyStats}>
                    HP: {enemy.hp} AC: {enemy.ac}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: THEME.background.secondary }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default function App() {
  // State declarations
  const [roomCode, setRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(isSmallScreen ? 0.8 : 1);
  const [tokens, setTokens] = useState({});
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [initiative, setInitiative] = useState([]);
  const [inCombat, setInCombat] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [layers, setLayers] = useState(initialGameState.layers);
  const [diceHistory, setDiceHistory] = useState([]);
  const [advantage, setAdvantage] = useState(false);
  const [modifier, setModifier] = useState(0);
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [partyLoot, setPartyLoot] = useState({
    currency: {
      CP: 0,
      SP: 0,
      EP: 0,
      GP: 0,
      PP: 0
    },
    items: [],
    currentViewer: null
  });
  const [showPartyLoot, setShowPartyLoot] = useState(false);
  const [diceQuantity, setDiceQuantity] = useState(1);
  const [characters, setCharacters] = useState([]);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showInventory, setShowInventory] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showPlayerNameModal, setShowPlayerNameModal] = useState(true);
  const [rollType, setRollType] = useState('normal'); // 'normal', 'advantage', or 'disadvantage'
  const [currentRollResult, setCurrentRollResult] = useState(null);
  // Add state for delete modal in App component
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [characterToDelete, setCharacterToDelete] = useState(null);
  // Add to your App component state
  const [isDM, setIsDM] = useState(false);
  const [showEnemySelect, setShowEnemySelect] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);

  // Refs
  const firebaseRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Helper Functions
  const handleDisconnect = useCallback(() => {
    try {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (firebaseRef.current) {
        off(firebaseRef.current);
        firebaseRef.current = null;
      }

      // Reset room-specific state
      setIsConnected(false);
      setRoomCode('');
      setTokens({});
      setLayers(initialGameState.layers);
      setInitiative([]);
      setInCombat(false);
      setCurrentTurn(0);
      setDiceHistory([]);
      setAdvantage(false);
      setModifier(0);
      setSelectedToken(null);
      setShowTokenModal(false);
      setPartyLoot(initialGameState.partyLoot);
      setZoomLevel(isSmallScreen ? 0.8 : 1);
      // Don't clear characters or player name
      
    } catch (error) {
      console.error('Error during disconnect:', error);
      Alert.alert('Error', 'Failed to leave room properly. Please try again.');
    }
  }, []);

  const handleInitiativeRoll = useCallback(() => {
    if (!tokens || Object.keys(tokens).length === 0) {
      Alert.alert('Error', 'No tokens on the board');
      return;
    }

    const rolls = Object.entries(tokens).map(([position, token]) => {
      const roll = Math.floor(Math.random() * 20) + 1;
      const initiative = roll + (token.initiativeBonus || 0);
      return {
        position,
        initiative,
        details: `${token.name} (${initiative})`
      };
    });

    rolls.sort((a, b) => b.initiative - a.initiative);
    
    if (firebaseRef.current) {
      set(firebaseRef.current, {
        ...initialGameState,
        tokens,
        layers,
        initiative: rolls,
        inCombat: true,
        currentTurn: 0
      });
    }

    setInitiative(rolls);
    setInCombat(true);
    setCurrentTurn(0);
  }, [tokens, layers]);

  const rollDice = useCallback((sides) => {
    const allRolls = [];
    
    // Roll for each die in quantity
    for (let d = 0; d < diceQuantity; d++) {
      const rolls = [];
      const numRolls = rollType !== 'normal' ? 2 : 1;
      
      // Roll with advantage/disadvantage if enabled
      for (let i = 0; i < numRolls; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
      
      const finalRoll = rollType === 'advantage' 
        ? Math.max(...rolls) 
        : rollType === 'disadvantage'
          ? Math.min(...rolls)
          : rolls[0];

      allRolls.push({
        rolls,
        total: finalRoll
      });
    }
    
    // Calculate grand total including modifier
    const grandTotal = allRolls.reduce((sum, roll) => sum + roll.total, 0) + modifier;
    
    const newResult = {
      dice: `${diceQuantity}d${sides}`,
      rolls: allRolls.map(r => r.rolls).flat(),
      individualTotals: allRolls.map(r => r.total),
      modifier,
      rollType,
      total: grandTotal,
      timestamp: Date.now()
    };
    
    setDiceHistory(prev => [newResult, ...prev.slice(0, 49)]);
    Vibration.vibrate(50);
  }, [rollType, modifier, diceQuantity]);

  // Update handleCellPress function
  const handleCellPress = useCallback(async (row, col) => {
    if (!firebaseRef.current) return;
    
    try {
      const position = `${row}-${col}`;
      const newTokens = { ...tokens };
      
      if (tokens[position]) {
        // Allow DM to remove any token, players can only remove their own
        if (isDM || tokens[position].owner === playerName) {
          delete newTokens[position];
        } else {
          Alert.alert('Error', 'You can only remove your own tokens');
          return;
        }
      } else {
        if (isDM) {
          // Show enemy selection for DM
          setSelectedPosition(position);
          setShowEnemySelect(true);
          return;
        } else {
          // Existing player character logic
          const playerCharacters = characters.filter(char => char.owner === playerName);
          
          if (playerCharacters.length === 0) {
            Alert.alert('Error', 'Create a character first to place a token');
            return;
          }

          // If player has only one character, use it automatically
          if (playerCharacters.length === 1) {
            const character = playerCharacters[0];
            newTokens[position] = {
              name: character.name,
              color: COLORS[0], // You might want to store a preferred color in character data
              hp: character.hp || 0,
              maxHp: character.maxHp || 0,
              ac: character.ac || 10,
              initiativeBonus: calculateModifier(character.abilityScores?.DEX || 10),
              effects: [],
              position,
              owner: playerName,
              characterId: character.name // Using name as ID since it should be unique per player
            };
          } else {
            // If player has multiple characters, show a selection dialog
            Alert.alert(
              'Select Character',
              'Which character would you like to place?',
              playerCharacters.map(char => ({
                text: char.name,
                onPress: () => {
                  newTokens[position] = {
                    name: char.name,
                    color: COLORS[0],
                    hp: char.hp || 0,
                    maxHp: char.maxHp || 0,
                    ac: char.ac || 10,
                    initiativeBonus: calculateModifier(char.abilityScores?.DEX || 10),
                    effects: [],
                    position,
                    owner: playerName,
                    characterId: char.name
                  };
                  
                  // Update Firebase
                  set(firebaseRef.current, {
                    tokens: newTokens,
                    layers,
                    initiative,
                    inCombat,
                    currentTurn,
                    partyLoot,
                    lastUpdate: Date.now()
                  });
                  
                  // Update local state
                  setTokens(newTokens);
                }
              })).concat([
                {
                  text: 'Cancel',
                  style: 'cancel'
                }
              ])
            );
            return; // Return early since the update will happen in the alert callback
          }
        }
      }

      // Update Firebase
      await set(firebaseRef.current, {
        tokens: newTokens,
        layers,
        initiative,
        inCombat,
        currentTurn,
        partyLoot,
        lastUpdate: Date.now()
      });

      // Update local state
      setTokens(newTokens);

    } catch (error) {
      console.error('Error updating tokens:', error);
      Alert.alert('Error', 'Failed to update token');
    }
  }, [tokens, characters, playerName, layers, initiative, inCombat, currentTurn, partyLoot, isDM]);

  // Add this helper function near the top of your file with other helper functions
  const calculateModifier = (score) => {
    return Math.floor((score - 10) / 2);
  };

  // Update the savePlayerData function
  const savePlayerData = useCallback(async (updatedCharacters) => {
    if (!playerName || !roomCode) return;
    
    try {
      // Save to both the room and a separate players collection
      const roomPlayerRef = ref(database, `rooms/${roomCode}/players/${playerName}`);
      const globalPlayerRef = ref(database, `players/${playerName}`);
      
      const playerData = {
        characters: updatedCharacters,
        lastUpdate: Date.now()
      };

      // Update both locations
      await Promise.all([
        set(roomPlayerRef, playerData),
        set(globalPlayerRef, playerData)
      ]);
    } catch (error) {
      console.error('Error saving player data:', error);
      Alert.alert('Error', 'Failed to save character data');
    }
  }, [playerName, roomCode]);

  // Update the connectToRoom function
  const connectToRoom = useCallback(async (code) => {
    if (!code.trim() || !playerName) {
      Alert.alert("Error", "Please enter a room code and player name");
      return;
    }

    setIsJoining(true);
    setIsLoading(true);

    try {
      // First try to load player's global data
      const globalPlayerRef = ref(database, `players/${playerName}`);
      const playerSnapshot = await get(globalPlayerRef);
      if (playerSnapshot.exists()) {
        const playerData = playerSnapshot.val();
        setCharacters(playerData.characters || []);
      }

      const gameRef = ref(database, `rooms/${code}`);
      firebaseRef.current = gameRef;

      // Check if room exists
      const snapshot = await get(gameRef);
      if (!snapshot.exists()) {
        await set(gameRef, initialGameState);
      }

      // Set up real-time listener
      const unsubscribe = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setTokens(data.tokens || {});
          setLayers(data.layers || initialGameState.layers);
          setInitiative(data.initiative || []);
          setInCombat(data.inCombat || false);
          setCurrentTurn(data.currentTurn || 0);
          setPartyLoot(data.partyLoot || initialGameState.partyLoot);
          
          // Update characters from room data if they exist
          if (data.players && data.players[playerName]) {
            setCharacters(data.players[playerName].characters || []);
          }
        }
      });

      unsubscribeRef.current = unsubscribe;
      setRoomCode(code);
      setShowRoomModal(false);
      setIsConnected(true);

    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert("Error", "Failed to join room. Please try again.");
      setIsConnected(false);
    } finally {
      setIsJoining(false);
      setIsLoading(false);
    }
  }, [playerName]);

  // Effects
  useEffect(() => {
    const handleOffline = () => {
      Alert.alert(
        'Connection Lost',
        'Please check your internet connection',
        [{ text: 'OK' }]
      );
    };

    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (firebaseRef.current) {
        off(firebaseRef.current);
      }
    };
  }, []);

  // Add to styles
  const layoutStyles = {
    sidePanel: {
      backgroundColor: THEME.background.panel,
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
      width: '100%',
    },
    sidePanelTitle: {
      color: THEME.text.light,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    panelButton: {
      backgroundColor: THEME.background.primary,
      padding: 10,
      borderRadius: 5,
      alignItems: 'center',
      flex: 1,
    },
    panelButtonText: {
      color: THEME.text.light,
      fontWeight: 'bold',
    },
    characterItem: {
      backgroundColor: THEME.background.primary,
      padding: 10,
      borderRadius: 5,
      marginBottom: 8,
    },
    characterInfo: {
      marginBottom: 5,
    },
    characterName: {
      color: THEME.text.light,
      fontSize: 16,
      fontWeight: 'bold',
    },
    characterDetails: {
      color: THEME.text.light + '80',
      fontSize: 12,
    },
    characterButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    characterButton: {
      padding: 8,
      borderRadius: 5,
      minWidth: 60,
      alignItems: 'center',
    },
    characterButtonText: {
      color: THEME.text.light,
      fontSize: 12,
      fontWeight: 'bold',
    },
  };

  // Define dynamic styles that depend on state
  const dynamicStyles = StyleSheet.create({
    dmToggle: {
      backgroundColor: isDM ? THEME.danger : THEME.background.secondary,
      padding: 10,
      borderRadius: 5,
      marginLeft: 10,
    },
  });

  // Main render return
  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkMode]}>
      <View style={styles.container}>
        {/* Modals stay at the top level */}
        <TokenModal 
          showTokenModal={showTokenModal}
          setShowTokenModal={setShowTokenModal}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          tokens={tokens}
          firebaseRef={firebaseRef}
          initialGameState={initialGameState}
          layers={layers}
          initiative={initiative}
          inCombat={inCombat}
          currentTurn={currentTurn}
          THEME={THEME}
        />
        
        <RoomModal 
          showRoomModal={showRoomModal}
          setShowRoomModal={setShowRoomModal}
          isConnected={isConnected}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          isJoining={isJoining}
          connectToRoom={connectToRoom}
        />

        <PlayerNameModal
          visible={showPlayerNameModal && !playerName}
          onSubmit={(name) => {
            setPlayerName(name);
            setShowPlayerNameModal(false);
            setIsConnected(true);
          }}
        />

        <PartyLootModal
          visible={showPartyLoot}
          onClose={() => setShowPartyLoot(false)}
          partyLoot={partyLoot}
          playerName={playerName}
          onUpdate={(updatedLoot) => {
            setPartyLoot(updatedLoot);
            if (firebaseRef.current) {
              set(firebaseRef.current, {
                ...initialGameState,
                tokens,
                layers,
                initiative,
                inCombat,
                currentTurn,
                partyLoot: updatedLoot
              });
            }
          }}
        />

        <CharacterSheetModal
          visible={showCharacterSheet}
          onClose={() => setShowCharacterSheet(false)}
          character={selectedCharacter || {
            name: '',
            class: '',
            level: 1,
            owner: playerName,
            proficiencyBonus: 2,
            abilityScores: {
              STR: 10,
              DEX: 10,
              CON: 10,
              INT: 10,
              WIS: 10,
              CHA: 10
            },
            proficientSkills: [],
            currency: {
              CP: 0,
              SP: 0,
              EP: 0,
              GP: 0,
              PP: 0
            },
            items: [],
            inventory: []
          }}
          characters={characters}
          onUpdate={async (updatedCharacter) => {
            try {
              if (!updatedCharacter) {
                throw new Error('No character data to save');
              }

              // Create new array with updated character
              const newCharacters = selectedCharacter
                ? characters.map(char => 
                    char.name === selectedCharacter.name ? updatedCharacter : char
                  )
                : [...characters, updatedCharacter];
              
              // Update local state first
              setCharacters(newCharacters);

              // Save to Firebase
              const playerRef = ref(database, `players/${playerName}`);
              await set(playerRef, {
                characters: newCharacters,
                lastUpdate: Date.now()
              });

              // Also save to room data
              if (firebaseRef.current) {
                const roomPlayerRef = ref(database, `rooms/${roomCode}/players/${playerName}`);
                await set(roomPlayerRef, {
                  characters: newCharacters,
                  lastUpdate: Date.now()
                });
              }

              setShowCharacterSheet(false);
              
            } catch (error) {
              console.error('Error saving character:', error);
              Alert.alert('Error', 'Failed to save character');
            }
          }}
        />

        <InventoryModal
          visible={showInventory}
          onClose={() => setShowInventory(false)}
          character={selectedCharacter}
          onUpdate={async (updatedCharacter) => {
            try {
              const newCharacters = characters.map(char => 
                char.name === selectedCharacter.name ? updatedCharacter : char
              );
              
              setCharacters(newCharacters);
              await savePlayerData(newCharacters);
              setShowInventory(false);
            } catch (error) {
              console.error('Error saving inventory:', error);
              Alert.alert('Error', 'Failed to save inventory');
            }
          }}
        />

        {!isConnected ? (
          <View style={styles.loadingContainer}>
            {isLoading ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={THEME.accent} />
                <Text style={[styles.loadingText, { marginTop: 20 }]}>
                  Connecting to room...
                </Text>
              </View>
            ) : (
              <Text style={styles.loadingText}>
                Enter a room code to begin
              </Text>
            )}
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>D&D Combat Tracker</Text>
              <ScrollView 
                horizontal={isSmallScreen} 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.controls}
              >
                <TouchableOpacity 
                  style={[styles.controlButton, { backgroundColor: THEME.primary }]}
                  onPress={() => setShowRoomModal(true)}
                >
                  <Text style={styles.buttonText}>Room: {roomCode}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[dynamicStyles.dmToggle]}
                  onPress={() => setIsDM(!isDM)}
                >
                  <Text style={styles.buttonText}>{isDM ? 'DM Mode' : 'Player Mode'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: THEME.primary }]}
                  onPress={handleInitiativeRoll}
                >
                  <Text style={styles.buttonText}>Roll Initiative</Text>
                </TouchableOpacity>

                {inCombat && (
                  <>
                    <TouchableOpacity
                      style={[styles.controlButton, { backgroundColor: THEME.success }]}
                      onPress={() => {
                        const nextTurn = (currentTurn + 1) % initiative.length;
                        setCurrentTurn(nextTurn);
                        if (firebaseRef.current) {
                          set(firebaseRef.current, {
                            ...initialGameState,
                            tokens,
                            layers,
                            initiative,
                            inCombat: true,
                            currentTurn: nextTurn
                          });
                        }
                      }}
                    >
                      <Text style={styles.buttonText}>Next Turn</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.controlButton, { backgroundColor: THEME.danger }]}
                      onPress={() => {
                        if (firebaseRef.current) {
                          set(firebaseRef.current, {
                            ...initialGameState,
                            tokens,
                            layers,
                            initiative: [],
                            inCombat: false,
                            currentTurn: 0
                          });
                        }
                        setInitiative([]);
                        setInCombat(false);
                        setCurrentTurn(0);
                      }}
                    >
                      <Text style={styles.buttonText}>End Combat</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: THEME.danger }]}
                  onPress={() => {
                    Alert.alert(
                      "Leave Room",
                      "Are you sure you want to leave this room?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Leave", 
                          style: "destructive",
                          onPress: () => {
                            // Disconnect from Firebase
                            if (unsubscribeRef.current) {
                              unsubscribeRef.current();
                              unsubscribeRef.current = null;
                            }
                            if (firebaseRef.current) {
                              off(firebaseRef.current);
                              firebaseRef.current = null;
                            }

                            // Reset state
                            setIsConnected(false);
                            setRoomCode('');
                            setTokens({});
                            setInitiative([]);
                            setInCombat(false);
                            setCurrentTurn(0);
                            setPartyLoot(initialGameState.partyLoot);
                            setShowRoomModal(true);
                            setShowPlayerNameModal(true);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.buttonText}>Leave Room</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            <ScrollView style={styles.content}>
              <View style={styles.mainArea}>
                {/* Grid Section */}
                <View style={styles.gridSection}>
                  <ScrollView 
                    horizontal 
                    contentContainerStyle={{ minWidth: '100%' }}
                  >
                    <ScrollView>
                      <View style={[
                        styles.gridContainer,
                        { transform: [{ scale: zoomLevel }] }
                      ]}>
                        {/* Color Picker */}
                        <View style={styles.colorPicker}>
                          {COLORS.map(color => (
                            <TouchableOpacity
                              key={color}
                              style={[
                                styles.colorButton,
                                { backgroundColor: color },
                                color === currentColor && styles.selectedColor
                              ]}
                              onPress={() => setCurrentColor(color)}
                            />
                          ))}
                        </View>

                        {/* Grid */}
                        {Array.from({ length: GRID_SIZE }).map((_, row) => (
                          <View key={row} style={styles.row}>
                            {Array.from({ length: GRID_SIZE }).map((_, col) => {
                              const position = `${row}-${col}`;
                              const token = tokens[position];
                              const isCurrentTurn = inCombat && 
                                initiative[currentTurn]?.position === position;

                              return (
                                <TouchableOpacity
                                  key={col}
                                  style={[
                                    styles.cell,
                                    token && { backgroundColor: token.color },
                                    isCurrentTurn && styles.currentTurn
                                  ]}
                                  onPress={() => handleCellPress(row, col)}
                                  onLongPress={() => {
                                    if (token) {
                                      setSelectedToken({ ...token, position });
                                      setShowTokenModal(true);
                                    }
                                  }}
                                >
                                  {token && (
                                    <View style={styles.tokenContent}>
                                      <Text style={[
                                        styles.tokenText,
                                        { color: token.color === '#ffffff' ? '#000000' : '#ffffff' }
                                      ]} numberOfLines={1}>
                                        {token.name}
                                      </Text>
                                      <Text style={[
                                        styles.tokenHp,
                                        { color: token.color === '#ffffff' ? '#000000' : '#ffffff' }
                                      ]}>
                                        {token.hp}/{token.maxHp}
                                      </Text>
                                      <Text style={[
                                        styles.tokenAc,
                                        { color: token.color === '#ffffff' ? '#000000' : '#ffffff' }
                                      ]}>
                                        AC: {token.ac}
                                      </Text>
                                      {token.effects && token.effects.length > 0 && (
                                        <View style={statusStyles.tokenEffects}>
                                          {token.effects.map(effect => {
                                            const statusEffect = STATUS_EFFECTS.find(e => e.id === effect);
                                            return statusEffect ? (
                                              <Text key={effect} style={statusStyles.effectIcon}>
                                                {statusEffect.icon}
                                              </Text>
                                            ) : null;
                                          })}
                                        </View>
                                      )}
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </ScrollView>
                  <GridZoomControls 
                    zoomLevel={zoomLevel}
                    setZoomLevel={setZoomLevel}
                  />
                </View>

                {/* Sidebar */}
                <View style={styles.sidebar}>
                  {/* Character Management Panel */}
                  <View style={layoutStyles.sidePanel}>
                    <Text style={layoutStyles.sidePanelTitle}>Character Management</Text>
                    <View style={layoutStyles.buttonRow}>
                      <TouchableOpacity
                        style={layoutStyles.panelButton}
                        onPress={() => {
                          setSelectedCharacter(null);
                          setShowCharacterSheet(true);
                        }}
                      >
                        <Text style={layoutStyles.panelButtonText}>New Character</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={layoutStyles.panelButton}
                        onPress={() => setShowPartyLoot(true)}
                      >
                        <Text style={layoutStyles.panelButtonText}>Party Loot</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Character List */}
                    <ScrollView style={{ maxHeight: 200 }}>
                      {characters
                        .filter(char => char.owner === playerName)
                        .map((char, index) => (
                          <View key={index} style={[layoutStyles.characterItem, { marginBottom: 8 }]}>
                            <View style={layoutStyles.characterInfo}>
                              <Text style={layoutStyles.characterName}>{char.name}</Text>
                              <Text style={layoutStyles.characterDetails}>
                                Level {char.level} {char.class}
                              </Text>
                            </View>
                            <View style={layoutStyles.characterButtons}>
                              <TouchableOpacity
                                style={[layoutStyles.characterButton, { backgroundColor: THEME.accent }]}
                                onPress={() => {
                                  setSelectedCharacter(char);
                                  setShowCharacterSheet(true);
                                }}
                              >
                                <Text style={layoutStyles.characterButtonText}>Sheet</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[layoutStyles.characterButton, { backgroundColor: THEME.success }]}
                                onPress={() => {
                                  setSelectedCharacter(char);
                                  setShowInventory(true);
                                }}
                              >
                                <Text style={layoutStyles.characterButtonText}>Loot</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[layoutStyles.characterButton, { backgroundColor: THEME.danger }]}
                                onPress={() => {
                                  setCharacterToDelete(char);
                                  setShowDeleteModal(true);
                                }}
                              >
                                <Text style={layoutStyles.characterButtonText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                    </ScrollView>
                  </View>

                  {/* Dice Roller Panel */}
                  <View style={diceStyles.dicePanel}>
                    <Text style={diceStyles.diceTitle}>Dice Roller</Text>

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
                      
                      <View style={diceStyles.controlsRow}>
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
                        <TouchableOpacity
                          key={sides}
                          style={[diceStyles.diceButton, { backgroundColor: color }]}
                          onPress={() => {
                            const allRolls = Array.from({ length: diceQuantity }, () => 
                              Math.floor(Math.random() * sides) + 1
                            );

                            const finalRolls = allRolls.map(roll => {
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
                              rolls: allRolls,
                              individualTotals: finalRolls,
                              modifier,
                              rollType,
                              total: total,
                              timestamp: Date.now()
                            };
                            
                            setCurrentRollResult(newResult);
                            Vibration.vibrate(50);
                          }}
                        >
                          <Text style={diceStyles.diceButtonText}>d{sides}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Initiative Panel */}
                  {inCombat && initiative.length > 0 && (
                    <View style={styles.initiativeList}>
                      <Text style={styles.boxTitle}>Initiative Order</Text>
                      <ScrollView style={styles.initiativeScroll}>
                        {initiative.map((item, index) => (
                          <View 
                            key={item.position}
                            style={[
                              styles.initiativeItem,
                              index === currentTurn && styles.currentInitiative
                            ]}
                          >
                            <Text style={[
                              styles.initiativeText,
                              index === currentTurn && styles.currentInitiativeText
                            ]}>
                              {item.details}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </>
        )}
      </View>

      {/* Add the overlay component at the root level of your app */}
      <DiceResultOverlay 
        result={currentRollResult}
        onClose={() => setCurrentRollResult(null)}
      />
      {/* Add the DeleteCharacterModal to your modals section */}
      <DeleteCharacterModal
        visible={showDeleteModal}
        character={characterToDelete}
        onClose={() => {
          setShowDeleteModal(false);
          setCharacterToDelete(null);
        }}
        onConfirm={async () => {
          try {
            // Filter out the character to delete
            const updatedCharacters = characters.filter(
              char => char.name !== characterToDelete.name
            );
            
            // Update local state
            setCharacters(updatedCharacters);
            
            // Save to Firebase
            await savePlayerData(updatedCharacters);
            
            // Close modal
            setShowDeleteModal(false);
            setCharacterToDelete(null);
            
            // Show success message
            Alert.alert('Success', 'Character deleted successfully');
            
          } catch (error) {
            console.error('Error deleting character:', error);
            Alert.alert('Error', 'Failed to delete character');
          }
        }}
      />
      <EnemySelectModal
        visible={showEnemySelect}
        onClose={() => setShowEnemySelect(false)}
        onSelect={async (enemy) => {
          if (selectedPosition && firebaseRef.current) {
            const newTokens = { ...tokens };
            const enemyCount = Object.values(tokens)
              .filter(t => t.name.startsWith(enemy.name))
              .length;
            
            newTokens[selectedPosition] = {
              ...enemy,
              name: `${enemy.name} ${enemyCount + 1}`,
              position: selectedPosition,
              owner: 'DM',
              effects: []
            };

            // Update Firebase
            await set(firebaseRef.current, {
              tokens: newTokens,
              layers,
              initiative,
              inCombat,
              currentTurn,
              partyLoot,
              lastUpdate: Date.now()
            });

            // Update local state
            setTokens(newTokens);
            setShowEnemySelect(false);
            setSelectedPosition(null);
          }
        }}
      />
    </SafeAreaView>
  );
}