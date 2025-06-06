# Test basic application initialization
def test_app_creates(app):
    """Test that the app can be created."""
    assert app is not None

def test_app_testing_config(app):
    """Test that the app is using testing configuration."""
    assert app.config['TESTING'] == True
