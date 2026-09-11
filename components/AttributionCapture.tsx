'use client';
import { useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution-client';
export default function AttributionCapture(){useEffect(()=>{captureAttribution();},[]);return null;}
