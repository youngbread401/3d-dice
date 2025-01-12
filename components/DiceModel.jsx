import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';

export const DiceRoller = ({ sides, onRoll, color, quantity = 1 }) => {
  const [rollingDice, setRollingDice] = useState(new Set());
  const [results, setResults] = useState([1]);
  const animationRefs = React.useRef(new Map()).current;

  const shineStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 'inherit'
  };

  const createDiceAnimation = (diceId) => {
    const rotateAnim = new Animated.Value(0);
    const bounceAnim = new Animated.Value(1);
    
    return {
      rotateAnim,
      bounceAnim,
      spin: rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
      })
    };
  };

  const roll = () => {
    const diceId = Date.now().toString();
    setRollingDice(prev => new Set(prev).add(diceId));
    
    if (!animationRefs.has(diceId)) {
      animationRefs.set(diceId, createDiceAnimation(diceId));
    }
    
    const anim = animationRefs.get(diceId);
    anim.rotateAnim.setValue(0);
    anim.bounceAnim.setValue(1);

    // Generate results first so they're consistent
    const newResults = Array.from({ length: quantity }, () => 
      Math.floor(Math.random() * sides) + 1
    );

    Animated.parallel([
      Animated.timing(anim.rotateAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false
      }),
      Animated.sequence([
        Animated.timing(anim.bounceAnim, {
          toValue: 1.2,
          duration: 100,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false
        }),
        Animated.timing(anim.bounceAnim, {
          toValue: 0.8,
          duration: 100,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false
        }),
        Animated.timing(anim.bounceAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false
        })
      ])
    ]).start(() => {
      setResults(newResults);
      setRollingDice(prev => {
        const next = new Set(prev);
        next.delete(diceId);
        return next;
      });
      
      if (rollingDice.size === 0) {
        animationRefs.delete(diceId);
      }
      
      // Pass all results to onRoll instead of just the first one
      onRoll(newResults);
    });
  };

  const getDieStyle = (diceId) => {
    const anim = animationRefs.get(diceId) || createDiceAnimation(diceId);
    const isRolling = rollingDice.has(diceId);
    
    const baseStyle = {
      width: 60,
      height: 60,
      backgroundColor: color,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
      transform: [
        { rotate: anim.spin },
        { scale: anim.bounceAnim }
      ],
      boxShadow: isRolling ? 
        '0 0 20px rgba(0,0,0,0.5) inset 0 0 15px rgba(255,255,255,0.5)' :
        '0 6px 12px rgba(0,0,0,0.4) inset 0 0 15px rgba(255,255,255,0.3)',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden'
    };

    switch (sides) {
      case 4:
        return {
          ...baseStyle,
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderLeftWidth: 35,
          borderRightWidth: 35,
          borderBottomWidth: 60,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          boxShadow: '0 8px 15px rgba(0,0,0,0.4)',
          transform: [
            { rotate: anim.spin },
            { scale: anim.bounceAnim },
            { translateY: -10 }
          ]
        };
      case 6:
        return {
          ...baseStyle,
          borderRadius: 8,
          boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
        };
      case 8:
        return {
          ...baseStyle,
          transform: [
            { rotate: anim.spin },
            { scale: anim.bounceAnim },
            { rotateX: '45deg' },
            { rotateZ: '45deg' }
          ],
          borderRadius: 15,
          boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
        };
      case 12:
        return {
          ...baseStyle,
          borderRadius: 20,
          transform: [
            { rotate: anim.spin },
            { scale: anim.bounceAnim },
            { rotateX: '25deg' }
          ],
          backgroundColor: color,
        };
      case 20:
        return {
          ...baseStyle,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          transform: [
            { rotate: anim.spin },
            { scale: anim.bounceAnim },
            { rotateX: '15deg' }
          ],
          backgroundColor: color,
        };
      case 100:
        return {
          ...baseStyle,
          borderRadius: 30,
          backgroundColor: color,
        };
      default:
        return baseStyle;
    }
  };

  // Helper function to adjust color brightness
  const adjustColor = (color, amount) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  return (
    <View 
      style={{
        padding: 10,
        alignItems: 'center',
        style: { pointerEvents: 'auto' }
      }}
    >
      <TouchableOpacity
        onPress={roll}
        activeOpacity={0.8}
      >
        {Array.from(rollingDice).map(diceId => (
          <Animated.View key={diceId} style={getDieStyle(diceId)}>
            <View style={shineStyle} />
            <Text
              style={{
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                textAlign: 'center',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              ?
            </Text>
          </Animated.View>
        ))}
        {rollingDice.size === 0 && (
          <Animated.View style={getDieStyle('static')}>
            <View style={shineStyle} />
            <Text
              style={{
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                textAlign: 'center',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {quantity > 1 ? 
                `${results.reduce((a, b) => a + b, 0)}` : 
                results[0]
              }
            </Text>
          </Animated.View>
        )}
      </TouchableOpacity>
      <Text 
        style={{ 
          color: 'white', 
          marginTop: 8,
          fontSize: 16,
          textAlign: 'center'
        }}
      >
        {quantity > 1 ? `${quantity}d${sides}` : `d${sides}`}
      </Text>
      {quantity > 1 && rollingDice.size === 0 && (
        <Text
          style={{
            color: 'white',
            marginTop: 4,
            fontSize: 12,
            opacity: 0.7,
            textAlign: 'center'
          }}
        >
          [{results.join(', ')}]
        </Text>
      )}
    </View>
  );
}; 