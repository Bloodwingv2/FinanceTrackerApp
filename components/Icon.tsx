import React from 'react';
import { Text } from 'react-native';

interface IconProps {
    name: string;
    size?: number;
    color?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#fff' }) => {
    const icons: Record<string, string> = {
        plus: '➕',
        trash: '🗑️',
        down: '📉',
        up: '📈',
        dollar: '💰',
        edit: '✏️',
        close: '✕',
        save: '💾',
        download: '⬇️',
        calendar: '📅',
        pie: '📊',
        database: '💾',
        folder: '📁',
        repeat: '🔄',
        sparkles: '✨',
        insights: '💡',
        trend: '📈',
        upload: '⬆️'
    };
    return <Text style={{ fontSize: size, color }}>{icons[name] || '•'}</Text>;
};

export default Icon;
