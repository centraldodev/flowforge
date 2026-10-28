import test from 'node:test';
import assert from 'node:assert/strict';
import type { Graph } from '../src/engine/types';
import {
  snapVisualPosition,
  defaultVisualStyle,
  visualStyle,
  generateVisualCss,
} from '../src/engine/visualDesign';
import {
  addVisualComponent,
  duplicateVisualComponent,
  prepareVisualScreen,
  removeVisualComponent,
  renameVisualComponent,
  screenComponents,
  updateComponentConfig,
  updateVisualScreen,
  updateVisualStyle,
} from '../src/features/frontend/visualProject';

function createBaseGraph(): Graph {
  return {
    version: 1,
    name: 'Frontend Test App',
    nodes: [
      {
        id: 'screen_home',
        type: 'block',
        position: { x: 50, y: 50 },
        data: {
          label: 'Tela Inicial',
          kind: 'screen',
          config: {
            screenUI: JSON.stringify({
              id: 'screen_home',
              name: 'Tela Inicial',
              root: {
                id: 'screen_home_root',
                type: 'container',
                children: [],
              },
            }),
          },
        },
      },
    ],
    edges: [],
  };
}

test('Frontend Builder: Adiciona múltiplos tipos de componentes visuais à tela', () => {
  let graph = createBaseGraph();

  // 1. Adiciona Botão Padrão e Botão Submit
  const { graph: g1, id: btnId } = addVisualComponent(graph, 'screen_home', 'button');
  const { graph: g2, id: submitId } = addVisualComponent(g1, 'screen_home', 'submit');

  // 2. Adiciona Campo de Texto e Título
  const { graph: g3, id: inputId } = addVisualComponent(g2, 'screen_home', 'input');
  const { graph: g4, id: headingId } = addVisualComponent(g3, 'screen_home', 'heading');

  // 3. Adiciona Card e Tabela
  const { graph: g5, id: cardId } = addVisualComponent(g4, 'screen_home', 'card');
  const { graph: g6, id: tableId } = addVisualComponent(g5, 'screen_home', 'table');

  // Testa renomear o botão
  graph = renameVisualComponent(g6, 'screen_home', btnId, 'Clique Aqui');

  const comps = screenComponents(graph, 'screen_home');
  assert.equal(comps.length, 6, 'Deve conter 6 componentes cadastrados');
  assert.ok(comps.some((c) => c.id === inputId));
  assert.ok(comps.some((c) => c.id === headingId));

  const renamedBtn = comps.find((c) => c.id === btnId);
  assert.equal('label' in renamedBtn! && renamedBtn.label, 'Clique Aqui');

  const submitComp = comps.find((c) => c.id === submitId);
  assert.ok(submitComp);
  assert.equal(submitComp.type, 'button');
  assert.equal('label' in submitComp && submitComp.label, 'Enviar');

  const cardComp = comps.find((c) => c.id === cardId);
  assert.ok(cardComp);
  assert.equal(cardComp.type, 'container');

  const tableComp = comps.find((c) => c.id === tableId);
  assert.ok(tableComp);
  assert.equal(tableComp.type, 'table');
});

test('Frontend Builder: Encaixe magnético (snapVisualPosition) gera linhas guias de alinhamento', () => {
  const sibling1 = defaultVisualStyle(0, 'mobile', 'button');
  sibling1.x = 50;
  sibling1.y = 100;
  sibling1.width = 200;
  sibling1.height = 50;

  // Movendo item perto da borda esquerda do sibling1 (x: 52 perto de 50)
  const snapLeft = snapVisualPosition(52, 200, 150, 40, [sibling1], 10);
  assert.equal(snapLeft.x, 50, 'Deve encaixar exatamente no X=50');
  assert.equal(snapLeft.guideX, 50, 'Deve gerar linha guia vertical no X=50');

  // Movendo item perto do centro do sibling1 (centro = 50 + 100 = 150)
  // Novo item largura 100 -> centro ficaria em x + 50 -> para alinhar centros, x deve ser 100
  const snapCenter = snapVisualPosition(98, 200, 100, 40, [sibling1], 10);
  assert.equal(snapCenter.x, 100, 'Deve alinhar centros perfeitamente');
  assert.equal(snapCenter.guideX, 150, 'Linha guia deve ficar na coordenada central');

  // Movendo item perto do topo do sibling1 (y: 102 perto de 100)
  const snapTop = snapVisualPosition(300, 102, 100, 40, [sibling1], 10);
  assert.equal(snapTop.y, 100, 'Deve encaixar no topo Y=100');
  assert.equal(snapTop.guideY, 100, 'Deve gerar linha guia horizontal no Y=100');
});

test('Frontend Builder: Edição de estilo independente por dispositivo (Mobile vs Desktop)', () => {
  let graph = createBaseGraph();
  const { graph: g1, id: btnId } = addVisualComponent(graph, 'screen_home', 'button');
  graph = g1;

  // Customiza estilo especificamente para mobile
  graph = updateVisualStyle(graph, 'screen_home', btnId, 'mobile', {
    width: 300,
    fontSize: 14,
    background: '#10b981',
  });

  // Customiza estilo especificamente para desktop
  graph = updateVisualStyle(graph, 'screen_home', btnId, 'desktop', {
    width: 600,
    fontSize: 20,
    background: '#6366f1',
  });

  const screen = prepareVisualScreen(graph, 'screen_home');
  const mobileStyle = visualStyle(screen, btnId, 'mobile', 0, 'button');
  const desktopStyle = visualStyle(screen, btnId, 'desktop', 0, 'button');

  assert.equal(mobileStyle.width, 300, 'Largura no mobile deve ser 300px');
  assert.equal(mobileStyle.fontSize, 14, 'Fonte no mobile deve ser 14px');
  assert.equal(mobileStyle.background, '#10b981');

  assert.equal(desktopStyle.width, 600, 'Largura no desktop deve ser 600px');
  assert.equal(desktopStyle.fontSize, 20, 'Fonte no desktop deve ser 20px');
  assert.equal(desktopStyle.background, '#6366f1');
});

test('Frontend Builder: Duplicar e Remover componentes na tela', () => {
  let graph = createBaseGraph();
  const { graph: g1, id: origId } = addVisualComponent(graph, 'screen_home', 'submit');
  graph = g1;

  // Duplicação
  const dup = duplicateVisualComponent(graph, 'screen_home', origId);
  assert.ok(dup, 'Duplicação deve ser bem-sucedida');
  graph = dup.graph;

  let comps = screenComponents(graph, 'screen_home');
  assert.equal(comps.length, 2, 'Deve conter original e clone');
  assert.ok(comps.some((c) => c.id === dup.id));

  // Remoção
  graph = removeVisualComponent(graph, 'screen_home', origId);
  comps = screenComponents(graph, 'screen_home');
  assert.equal(comps.length, 1, 'Deve sobrar apenas o clone');
  assert.equal(comps[0].id, dup.id);
});

test('Frontend Builder: generateVisualCss emite CSS com flexbox, direção, gap e responsividade', () => {
  let graph = createBaseGraph();
  const { graph: g1, id: btnId } = addVisualComponent(graph, 'screen_home', 'submit');
  graph = updateVisualStyle(g1, 'screen_home', btnId, 'mobile', {
    flex: true,
    flexDirection: 'column',
    gap: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    radius: 12,
    shadow: true,
    shadowBlur: 20,
  });

  const css = generateVisualCss(graph.visualDesign);
  assert.ok(css.includes('container-type: inline-size'));
  assert.ok(css.includes('display:flex'));
  assert.ok(css.includes('flex-direction:column'));
  assert.ok(css.includes('gap:16px'));
  assert.ok(css.includes('border:2px dashed'));
  assert.ok(css.includes('border-radius:12px'));
  assert.ok(css.includes('box-shadow:0 5px 20px'));
  assert.ok(css.includes('[data-device="mobile"]'));
  assert.ok(css.includes('background:transparent !important'));
  assert.ok(css.includes('border:none !important'));
});

test('Frontend Builder: Adiciona Google Icons e Modelos pré-configurados (Header, Instagram Footer, FAB)', () => {
  const graph = createBaseGraph();

  // 1. Google Icon
  const { graph: g1, id: iconId } = addVisualComponent(graph, 'screen_home', 'icon', {
    iconName: 'favorite',
  });
  // 2. Circular FAB (+)
  const { graph: g2, id: fabId } = addVisualComponent(g1, 'screen_home', 'fab');
  // 3. Extended FAB
  const { graph: g3, id: fabExtId } = addVisualComponent(g2, 'screen_home', 'fab_extended', {
    label: 'Criar Item',
  });
  // 4. Header do Aplicativo
  const { graph: g4, id: headerId } = addVisualComponent(g3, 'screen_home', 'header_app', {
    label: 'Meu App',
  });
  // 5. Footer Mobile Instagram
  const { graph: g5, id: footerId } = addVisualComponent(g4, 'screen_home', 'footer_instagram');

  const comps = screenComponents(g5, 'screen_home');
  assert.equal(comps.length, 5, 'Deve conter os 5 novos componentes');

  // Valida Google Icon
  const iconComp = comps.find((c) => c.id === iconId);
  assert.ok(iconComp);
  assert.equal(iconComp.type, 'icon');
  assert.equal('iconName' in iconComp && iconComp.iconName, 'favorite');

  // Valida Circular FAB
  const fabComp = comps.find((c) => c.id === fabId);
  assert.ok(fabComp);
  assert.equal(fabComp.type, 'button');
  assert.equal('iconName' in fabComp && fabComp.iconName, 'add');

  // Valida Extended FAB
  const fabExtComp = comps.find((c) => c.id === fabExtId);
  assert.ok(fabExtComp);
  assert.equal(fabExtComp.type, 'button');
  assert.equal('label' in fabExtComp && fabExtComp.label, 'Criar Item');
  assert.equal('iconName' in fabExtComp && fabExtComp.iconName, 'add');

  // Valida Header
  const headerComp = comps.find((c) => c.id === headerId);
  assert.ok(headerComp);
  assert.equal(headerComp.type, 'container');
  assert.equal('variant' in headerComp && headerComp.variant, 'header');
  assert.equal('title' in headerComp && headerComp.title, 'Meu App');

  // Valida Footer Mobile (Instagram)
  const footerComp = comps.find((c) => c.id === footerId);
  assert.ok(footerComp);
  assert.equal(footerComp.type, 'container');
  assert.equal('variant' in footerComp && footerComp.variant, 'footer');
  assert.ok('navItems' in footerComp && Array.isArray(footerComp.navItems));
  assert.equal(footerComp.navItems.length, 5, 'Instagram footer deve ter 5 abas acessíveis');
  assert.deepEqual(
    footerComp.navItems.map((item) => item.icon),
    ['home', 'folder', 'add_box', 'favorite', 'person'],
  );

  // Valida Estilos Pré-configurados (Mobile)
  const screen = prepareVisualScreen(g5, 'screen_home');
  const fabStyle = visualStyle(screen, fabId, 'mobile', 1, 'fab');
  assert.equal(fabStyle.radius, 999, 'FAB deve ser circular (radius 999)');
  assert.equal(fabStyle.width, 56, 'FAB deve ter largura 56px');
  assert.equal(fabStyle.height, 56, 'FAB deve ter altura 56px');
  assert.equal(fabStyle.shadow, true, 'FAB deve ter sombra elevada');
  assert.ok(fabStyle.x > 250, 'FAB deve ficar ancorado à direita no mobile');
  assert.ok(fabStyle.y > 600, 'FAB deve ficar ancorado no canto inferior');

  const headerStyle = visualStyle(screen, headerId, 'mobile', 3, 'header_app');
  assert.equal(headerStyle.x, 0, 'Header começa em X=0');
  assert.equal(headerStyle.y, 0, 'Header começa em Y=0');
  assert.equal(headerStyle.width, 375, 'Header preenche a largura da tela mobile (375px)');
  assert.equal(headerStyle.height, 56, 'Header tem altura 56px');

  const footerStyle = visualStyle(screen, footerId, 'mobile', 4, 'footer_instagram');
  assert.equal(footerStyle.x, 0, 'Footer começa em X=0');
  assert.equal(footerStyle.y, 812 - 64, 'Footer fica no rodapé da tela mobile (812 - 64 = 748)');
  assert.equal(footerStyle.width, 375, 'Footer preenche largura mobile (375px)');
  assert.equal(footerStyle.height, 64, 'Footer tem altura 64px');
  assert.equal(footerStyle.justify, 'around', 'Footer distribui abas uniformemente');
});

test('Frontend Builder: Adiciona Dropdown e Hambúrguer com opções vinculadas a telas, fluxos e backend store', () => {
  const graph = createBaseGraph();

  // 1. Adiciona Botão Dropdown
  const { graph: g1, id: dropId } = addVisualComponent(graph, 'screen_home', 'dropdown', {
    label: 'Categorias do App',
  });

  // 2. Adiciona Menu Hambúrguer
  const { graph: g2, id: burgerId } = addVisualComponent(g1, 'screen_home', 'hamburger');

  const comps = screenComponents(g2, 'screen_home');
  assert.equal(comps.length, 2, 'Deve conter 2 componentes');

  // Valida Dropdown
  const dropComp = comps.find((c) => c.id === dropId);
  assert.ok(dropComp);
  assert.equal(dropComp.type, 'dropdown');
  assert.equal('label' in dropComp && dropComp.label, 'Categorias do App');
  assert.ok('items' in dropComp && Array.isArray(dropComp.items));
  assert.ok(dropComp.items.length >= 2, 'Dropdown deve vir com itens padrão');
  assert.equal(dropComp.items[0].actionType, 'screen');
  assert.equal(dropComp.items[0].targetScreenId, 'screen_home');

  // Valida Menu Hambúrguer
  const burgerComp = comps.find((c) => c.id === burgerId);
  assert.ok(burgerComp);
  assert.equal(burgerComp.type, 'hamburger');
  assert.equal('iconName' in burgerComp && burgerComp.iconName, 'menu');
  assert.ok('items' in burgerComp && Array.isArray(burgerComp.items));
  assert.ok(burgerComp.items.length >= 3, 'Hambúrguer deve conter opções de navegação padrão');

  // 3. Atualiza vinculação dinâmica ao backend (itemsPath) e opções personalizadas
  const g3 = updateComponentConfig(g2, 'screen_home', dropId, {
    itemsPath: 'backend_categorias',
    items: [
      {
        id: 'opt_1',
        label: 'Eletrônicos',
        icon: 'devices',
        actionType: 'value',
        value: 'categoria_eletronicos',
      },
      {
        id: 'opt_2',
        label: 'Ir para Dashboard',
        icon: 'dashboard',
        actionType: 'screen',
        targetScreenId: 'screen_home',
      },
      {
        id: 'opt_3',
        label: 'Sincronizar Dados',
        icon: 'sync',
        actionType: 'workflow',
        actionEvent: 'wf_sync_data',
      },
    ],
  });

  const updatedComps = screenComponents(g3, 'screen_home');
  const updatedDrop = updatedComps.find((c) => c.id === dropId);
  assert.ok(updatedDrop && updatedDrop.type === 'dropdown');
  assert.equal(updatedDrop.itemsPath, 'backend_categorias');
  assert.equal(updatedDrop.items.length, 3);
  assert.equal(updatedDrop.items[0].actionType, 'value');
  assert.equal(updatedDrop.items[0].value, 'categoria_eletronicos');
  assert.equal(updatedDrop.items[1].actionType, 'screen');
  assert.equal(updatedDrop.items[1].targetScreenId, 'screen_home');
  assert.equal(updatedDrop.items[2].actionType, 'workflow');
  assert.equal(updatedDrop.items[2].actionEvent, 'wf_sync_data');

  // 4. Valida estilos visuais padrão dos dois componentes
  const screen = prepareVisualScreen(g3, 'screen_home');
  const dropStyle = visualStyle(screen, dropId, 'mobile', 0, 'dropdown');
  assert.equal(dropStyle.height, 46, 'Dropdown tem altura ergonômica de 46px');
  assert.equal(dropStyle.flex, true, 'Dropdown usa flexbox');
  assert.equal(dropStyle.justify, 'between', 'Dropdown separa rótulo e seta de abertura');
  assert.equal(dropStyle.radius, 8, 'Dropdown tem borda arredondada');

  const burgerStyle = visualStyle(screen, burgerId, 'mobile', 1, 'hamburger');
  assert.equal(burgerStyle.width, 44, 'Hambúrguer tem touch target de 44px');
  assert.equal(burgerStyle.height, 44, 'Hambúrguer tem altura de 44px');
  assert.equal(burgerStyle.align, 'center', 'Hambúrguer alinha ícone ao centro');
});

test('Frontend Builder: Configuração de dispositivos ativos por tela e replicação global', () => {
  let graph = createBaseGraph();
  // Adiciona segunda tela
  graph = {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        id: 'screen_profile',
        type: 'block',
        position: { x: 200, y: 50 },
        data: {
          label: 'Perfil',
          kind: 'screen',
          config: {
            screenUI: JSON.stringify({
              id: 'screen_profile',
              name: 'Perfil',
              root: { id: 'screen_profile_root', type: 'container', children: [] },
            }),
          },
        },
      },
    ],
  };

  // 1. Inicialmente ambas telas possuem mobile, tablet, desktop
  const sHomeInit = prepareVisualScreen(graph, 'screen_home');
  const sProfInit = prepareVisualScreen(graph, 'screen_profile');
  assert.deepEqual(sHomeInit.enabled, ['mobile', 'tablet', 'desktop']);
  assert.deepEqual(sProfInit.enabled, ['mobile', 'tablet', 'desktop']);

  // 2. Modifica dispositivos ativos apenas de screen_home (ex: desabilita desktop)
  graph = updateVisualScreen(graph, 'screen_home', (screen) => ({
    ...screen,
    enabled: ['mobile', 'tablet'],
  }));

  assert.deepEqual(prepareVisualScreen(graph, 'screen_home').enabled, ['mobile', 'tablet']);
  assert.deepEqual(prepareVisualScreen(graph, 'screen_profile').enabled, [
    'mobile',
    'tablet',
    'desktop',
  ]);

  // 3. Aplica os dispositivos de screen_home a todas as telas do projeto
  const screens = graph.nodes.filter((n) => n.data.kind === 'screen');
  const targetEnabled = prepareVisualScreen(graph, 'screen_home').enabled;
  for (const scr of screens) {
    graph = updateVisualScreen(graph, scr.id, (s) => ({ ...s, enabled: targetEnabled }));
  }

  assert.deepEqual(prepareVisualScreen(graph, 'screen_home').enabled, ['mobile', 'tablet']);
  assert.deepEqual(prepareVisualScreen(graph, 'screen_profile').enabled, ['mobile', 'tablet']);
});
