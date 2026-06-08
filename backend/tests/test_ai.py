from unittest.mock import MagicMock, patch


def test_ai_test_endpoint_requires_auth(client):
    response = client.post("/api/ai/test")
    assert response.status_code == 401


def test_ai_test_endpoint(authed_client):
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="4")]
    mock_client.messages.create.return_value = mock_message

    with patch("ai._client", mock_client):
        response = authed_client.post("/api/ai/test")

    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["response"] == "4"
    mock_client.messages.create.assert_called_once()


def test_ai_test_endpoint_returns_string(authed_client):
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="The answer is 4.")]
    mock_client.messages.create.return_value = mock_message

    with patch("ai._client", mock_client):
        response = authed_client.post("/api/ai/test")

    assert response.status_code == 200
    assert isinstance(response.json()["response"], str)
