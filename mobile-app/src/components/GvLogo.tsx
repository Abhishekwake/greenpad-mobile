import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { GV_LOGO_SVG_XML } from '../assets/gvLogoSvgXml';

const VIEWBOX_W = 285;
const VIEWBOX_H = 245;

type Props = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const GvLogo: React.FC<Props> = ({ width = 200, height, style }) => {
  const h = height ?? Math.round((width * VIEWBOX_H) / VIEWBOX_W);
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <SvgXml xml={GV_LOGO_SVG_XML} width={width} height={h} />
    </View>
  );
};

export default GvLogo;
