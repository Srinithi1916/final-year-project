import React from 'react';
import { Card } from './ui/card';
import { Shield, AlertTriangle, Activity } from 'lucide-react';

interface AttackStatusBannerProps {
  prediction: string;
  confidence: number;
}

export function AttackStatusBanner({ prediction, confidence }: AttackStatusBannerProps) {
  const isAttack = prediction !== 'Normal';
  const isZeroDay = prediction === 'Zero-Day';

  return (
    <div className={`relative overflow-hidden rounded-3xl ${
      isZeroDay
        ? 'bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600'
        : isAttack 
        ? 'bg-gradient-to-r from-red-500 via-red-600 to-orange-600' 
        : 'bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600'
    } shadow-2xl`}>
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="relative px-8 py-12">
        <div className="flex items-center justify-between">
          
          {/* Left side - Status */}
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-2xl ${
              isAttack ? 'bg-red-700/50' : 'bg-green-700/50'
            } backdrop-blur-sm`}>
              {isAttack ? (
                <AlertTriangle className="size-16 text-white" />
              ) : (
                <Shield className="size-16 text-white" />
              )}
            </div>

            <div>
              <div className="text-white/80 text-lg font-medium mb-2">
                Network Status
              </div>
              <div className="text-white text-6xl font-black tracking-tight">
                {isAttack ? 'ATTACK DETECTED' : 'NORMAL'}
              </div>
              <div className="text-white/90 text-xl mt-2 font-medium">
                {prediction} {isAttack && `Attack`}
              </div>
            </div>
          </div>

          {/* Right side - Confidence */}
          <div className="text-right">
            <div className="text-white/80 text-lg font-medium mb-2">
              Confidence Level
            </div>
            <div className="text-white text-7xl font-black">
              {confidence.toFixed(0)}%
            </div>
            <div className="mt-3">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
                <Activity className="size-5 text-white" />
                <span className="text-white font-semibold">
                  {confidence > 90 ? 'Very High' : confidence > 75 ? 'High' : confidence > 60 ? 'Medium' : 'Low'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Threat Level Indicator */}
        {isAttack && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="text-white/90 font-medium">Threat Assessment</div>
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-3 h-12 rounded ${
                      i < Math.ceil(confidence / 20) 
                        ? 'bg-white' 
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}