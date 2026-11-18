import math

def oklch_to_srgb(L, C, h_deg):
    h_rad = math.radians(h_deg)
    a = C * math.cos(h_rad)
    b = C * math.sin(h_rad)

    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b

    l = l_ ** 3
    m = m_ ** 3
    s = s_ ** 3

    r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def gamma(val):
        if val <= 0:
            return 0.0
        if val >= 1:
            return 1.0
        if val <= 0.0031308:
            return 12.92 * val
        else:
            return 1.055 * (val ** (1.0 / 2.4)) - 0.055

    r = gamma(r_lin)
    g = gamma(g_lin)
    b = gamma(b_lin)

    # strictly inside [0, 1] with 1e-4 tolerance
    in_gamut = (-0.0001 <= r_lin <= 1.0001) and (-0.0001 <= g_lin <= 1.0001) and (-0.0001 <= b_lin <= 1.0001)
    return (r, g, b, in_gamut, r_lin, g_lin, b_lin)

def relative_luminance(rgb):
    def channel_lum(c):
        if c <= 0.04045:
            return c / 12.92
        else:
            return ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * channel_lum(r) + 0.7152 * channel_lum(g) + 0.0722 * channel_lum(b)

def contrast_ratio(rgb1, rgb2):
    lum1 = relative_luminance(rgb1)
    lum2 = relative_luminance(rgb2)
    l_max = max(lum1, lum2)
    l_min = min(lum1, lum2)
    return (l_max + 0.05) / (l_min + 0.05)

# Adjusting amber and green tag
candidates = {
    "brand_forest": (0.38, 0.075, 162.0),
    "brand_forest_hover": (0.33, 0.070, 162.0),
    "brand_forest_subtle": (0.95, 0.020, 162.0),
    "surface_base": (0.985, 0.004, 95.0),
    "surface_card": (1.0, 0.0, 0.0),
    "surface_sidebar": (0.24, 0.035, 162.0),
    "surface_sidebar_hover": (0.29, 0.035, 162.0),
    "text_primary": (0.20, 0.010, 150.0),
    "text_secondary": (0.44, 0.018, 150.0),
    "text_muted": (0.55, 0.015, 150.0),
    "text_inverse": (0.99, 0.002, 95.0),
    "text_sidebar_primary": (0.96, 0.010, 95.0),
    "text_sidebar_muted": (0.75, 0.018, 150.0),
    "border_subtle": (0.90, 0.008, 95.0),
    "border_sidebar": (0.32, 0.025, 162.0),
    "accent_emerald": (0.45, 0.095, 155.0),
    "accent_amber_text": (0.50, 0.095, 75.0), # amber text
    "accent_amber_badge": (0.78, 0.110, 75.0),
    "accent_crimson": (0.48, 0.150, 25.0),
    "accent_crimson_badge": (0.94, 0.030, 25.0),
    "accent_azure": (0.52, 0.110, 240.0),
    "tag_bg_green": (0.94, 0.025, 162.0),
    "tag_text_green": (0.30, 0.055, 162.0), # slightly higher L, moderate C
}

all_ok = True
rgbs = {}
print("=== S-RGB GAMUT CHECK ===")
for name, (L, C, h) in candidates.items():
    r, g, b, in_gamut, rl, gl, bl = oklch_to_srgb(L, C, h)
    rgbs[name] = (r, g, b)
    if not in_gamut:
        all_ok = False
        print(f"FAILED GAMUT: {name} (r_lin={rl:.4f}, g_lin={gl:.4f}, b_lin={bl:.4f})")
    else:
        print(f"OK: {name:20}: oklch({L:.3f} {C:.3f} {h:5.1f}) -> #{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}")

print("\nAll in Gamut:", all_ok)

print("\n=== CONTRAST VERIFICATIONS ===")
pairs = [
    ("text_primary", "surface_base"),
    ("text_primary", "surface_card"),
    ("text_secondary", "surface_base"),
    ("text_secondary", "surface_card"),
    ("text_muted", "surface_card"),
    ("text_inverse", "brand_forest"),
    ("text_sidebar_primary", "surface_sidebar"),
    ("text_sidebar_muted", "surface_sidebar"),
    ("tag_text_green", "tag_bg_green"),
    ("accent_crimson", "surface_card"),
    ("accent_amber_text", "surface_card"),
]

for t, b in pairs:
    ratio = contrast_ratio(rgbs[t], rgbs[b])
    wcag_aa = "PASS AA (>=4.5)" if ratio >= 4.5 else "FAIL AA"
    print(f"{t:22} on {b:20}: {ratio:5.2f}:1  [{wcag_aa}]")
