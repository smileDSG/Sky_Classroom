'use client';

// 把「当前宠物 + 当前主题」解析成小镜头像, 挂在全局(见 deferred-global-services)。
//
// 之前这套换算只在主页的 home-live2d-pet 里做, 于是离开主页之后主题再切换,
// 头像就定格在离开时的那个 —— 猫不会跟着亮暗换。放到全局后:
//   亮色 → 白猫(mao.png)   暗色 → 黑猫(heimao.png)
//   人形 → ren.jpg, 与主题无关(不随亮暗变化)
// 纯新增、可回滚: 删掉这个文件与 deferred-global-services 里那一行即可。

import { useEffect } from 'react';
import { useTheme } from '@/lib/hooks/use-theme';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

export function MascotSync() {
  const { resolvedTheme } = useTheme();
  const petKind = useSkyClassroomStore((s) => s.petKind);
  const setMascotImage = useSkyClassroomStore((s) => s.setMascotImage);

  useEffect(() => {
    const img =
      petKind === 'vrm'
        ? '/avatars/mascot/ren.jpg'
        : resolvedTheme === 'dark'
          ? '/avatars/mascot/heimao.png'
          : '/avatars/mascot/mao.png';
    setMascotImage(img);
  }, [petKind, resolvedTheme, setMascotImage]);

  return null;
}
