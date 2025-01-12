import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: '#2C3A47' 
        }}>
          <Text style={{ 
            color: '#F5E6D3', 
            fontSize: 18, 
            marginBottom: 20 
          }}>
            Something went wrong
          </Text>
          <TouchableOpacity
            onPress={() => window.location.reload()}
            style={{ 
              padding: 10, 
              backgroundColor: '#C4A484', 
              borderRadius: 5 
            }}
          >
            <Text style={{ color: '#2C3A47' }}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;