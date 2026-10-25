import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [{
    name: 'score-snapshots',
    resolveId(id) { if (id === 'virtual:scores') return '\0virtual:scores'; },
    load(id) {
      if (id !== '\0virtual:scores') return;
      const raw = JSON.parse(readFileSync('results/team_scores.json', 'utf8'));
      const events = raw.events.map(({event_number, event_name, standings}) => ({event_number, event_name, standings}));
      return 'export default ' + JSON.stringify({events});
    },
    handleHotUpdate({file, server}) {
      if(file.endsWith('team_scores.json')) {
        const mod = server.moduleGraph.getModuleById('\0virtual:scores');
        if(mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({type:'full-reload'});
      }
    }
  }],
  build: { sourcemap: false }
});
