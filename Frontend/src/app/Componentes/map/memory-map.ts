import {
  ChangeDetectionStrategy, Component, OnDestroy, OnInit,
  ElementRef, ViewChild, input, output, effect,
} from '@angular/core';

export interface MapPin {
  name: string;
  lat: number | null;
  lng: number | null;
  count: number;
  photoUrl?: string;
}

@Component({
  selector: 'app-memory-map',
  template: `
    <div #mapEl class="map-el" role="region" aria-label="Mapa de recuerdos"></div>
  `,
  styles: [`
    :host { display: block; }
    .map-el { width: 100%; height: 100%; border-radius: inherit; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoryMap implements OnInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  readonly pins      = input<MapPin[]>([]);
  readonly center    = input<[number, number]>([14.64, -90.51]); // Guatemala por default
  readonly zoom      = input<number>(7);
  readonly pinClicked = output<MapPin>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private markers: any[] = [];
  private L: typeof import('leaflet') | null = null;

  constructor() {
    effect(() => {
      const pins = this.pins();
      if (this.map && this.L) this.refreshPins(pins);
    });
  }

  async ngOnInit() {
    this.L = await import('leaflet');
    this.initMap();
  }

  private initMap() {
    if (!this.L) return;
    const L = this.L;

    // Fix default icon paths for bundled environments
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
    L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

    this.map = L.map(this.mapEl.nativeElement, {
      center: this.center(),
      zoom: this.zoom(),
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
    }).addTo(this.map);

    this.refreshPins(this.pins());
  }

  private refreshPins(pins: MapPin[]) {
    if (!this.map || !this.L) return;
    const L = this.L;

    // Remove old markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    pins.filter(p => p.lat !== null && p.lng !== null).forEach(pin => {
      const html = `
        <div style="
          background: #D97757;
          color: white;
          border-radius: 50%;
          width: ${Math.min(36, 20 + pin.count * 4)}px;
          height: ${Math.min(36, 20 + pin.count * 4)}px;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: ${pin.count > 1 ? '11px' : '0'};
          border: 2px solid rgba(255,255,255,0.6);
          box-shadow: 0 2px 10px rgba(217,119,87,0.6);
          font-family: Inter, sans-serif;
        ">${pin.count > 1 ? pin.count : ''}</div>
      `;
      const icon = L.divIcon({
        html,
        className: '',
        iconSize: [Math.min(36, 20 + pin.count * 4), Math.min(36, 20 + pin.count * 4)],
        iconAnchor: [Math.min(18, 10 + pin.count * 2), Math.min(18, 10 + pin.count * 2)],
      });

      const marker = L.marker([pin.lat!, pin.lng!], { icon })
        .addTo(this.map)
        .bindTooltip(`${pin.name} · ${pin.count} ${pin.count === 1 ? 'recuerdo' : 'recuerdos'}`, {
          permanent: false,
          className: 'map-tooltip',
        });

      marker.on('click', () => this.pinClicked.emit(pin));
      this.markers.push(marker);
    });

    // Auto-fit bounds if multiple pins
    const valid = pins.filter(p => p.lat !== null && p.lng !== null);
    if (valid.length > 1) {
      const bounds = L.latLngBounds(valid.map(p => [p.lat!, p.lng!] as [number, number]));
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (valid.length === 1) {
      this.map.setView([valid[0].lat!, valid[0].lng!], 13);
    }
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
  }
}
