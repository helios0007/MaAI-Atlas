"""
Compatibility wrapper. The v1 generator now lives in pipeline/ (the original is in legacy/).

    python generate_atlas_data.py            == python -m pipeline.run
    python generate_atlas_data.py --mesh x   == python -m pipeline.run --mesh x
"""

from pipeline.run import main

if __name__ == "__main__":
    main()
