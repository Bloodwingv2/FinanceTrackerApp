import { StyleSheet, View, Text } from 'react-native';
import { styles as appStyles } from './styles';

export default function TabTwoScreen() {
  return (
    <View style={[appStyles.container, styles.container]}>
      <Text style={appStyles.title}>Insights & Settings</Text>
      <View style={styles.content}>
        <Text style={appStyles.subtitle}>Coming Soon</Text>
        <Text style={styles.description}>
          Advanced analytics and app settings will be available here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    color: '#a0aec0',
    marginTop: 10,
    textAlign: 'center',
  }
});
